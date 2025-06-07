
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Filter, AlertTriangle, Loader2, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, get, query, onValue, off, type DataSnapshot, push, serverTimestamp, runTransaction } from 'firebase/database';
import type { Transaction, TransactionStatus, WithdrawalRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface TransactionHistoryTabProps {
  authUserUid: string | null;
}

export default function TransactionHistoryTab({ authUserUid }: TransactionHistoryTabProps) {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const processedRefundsRef = useRef<Set<string>>(new Set());

  // State for modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [withdrawalRequestDetails, setWithdrawalRequestDetails] = useState<WithdrawalRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingModalDetails, setIsLoadingModalDetails] = useState(false);


  useEffect(() => {
    if (!authUserUid) {
      setIsLoading(false);
      return;
    }
    const transactionsRef = ref(database, `transactions/${authUserUid}`);
    
    const listenerCallback = async (snapshot: DataSnapshot) => {
      console.log("[TransactionHistoryTab] Transactions listener fired.");
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedTransactions: Transaction[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] as Transaction }))
          .sort((a, b) => b.date - a.date); 
        
        for (const tx of loadedTransactions) {
          if (tx.type === 'withdrawal' && 
              tx.status === 'Rejected' && 
              tx.id && 
              !processedRefundsRef.current.has(tx.id)) {
            
            console.log(`[TransactionHistoryTab] Detected rejected withdrawal to refund: ${tx.id}, Amount: ${tx.amount}`);
            
            const refundDescriptionSuffix = `(Ref ID: ${tx.id})`;
            const alreadyRefunded = loadedTransactions.some(
                existingTx => existingTx.description?.endsWith(refundDescriptionSuffix) && 
                              existingTx.type === 'earning' && 
                              existingTx.status === 'Earned'
            );

            if (!alreadyRefunded) {
                console.log(`[TransactionHistoryTab] Simulating refund for ${tx.id}.`);
                const refundAmount = Math.abs(tx.amount);
                const refundTransactionData: Transaction = {
                    date: serverTimestamp() as number,
                    description: `Refund for rejected withdrawal ${refundDescriptionSuffix}`,
                    amount: refundAmount,
                    type: 'earning', 
                    status: 'Earned', 
                    notes: `Automatic refund for rejected withdrawal ${tx.id}`,
                    withdrawalRequestId: tx.withdrawalRequestId // Carry over withdrawalRequestId if present
                };

                try {
                    await push(ref(database, `transactions/${authUserUid}`), refundTransactionData);
                    const userBalanceRef = ref(database, `users/${authUserUid}/totalEarnings`);
                    await runTransaction(userBalanceRef, (currentEarnings) => {
                        return (currentEarnings || 0) + refundAmount;
                    });
                    
                    toast({ title: "Withdrawal Rejected & Refunded", description: `₹${refundAmount.toFixed(2)} has been credited back to your balance for rejected withdrawal.` });
                    processedRefundsRef.current.add(tx.id); 
                } catch (error) {
                    console.error("[TransactionHistoryTab] Error processing simulated refund:", error);
                    toast({ title: "Refund Error", description: "Could not process automatic refund for a rejected withdrawal.", variant: "destructive"});
                }
            } else {
                console.log(`[TransactionHistoryTab] Refund for ${tx.id} appears to already exist or was processed.`);
                processedRefundsRef.current.add(tx.id); 
            }
          }
        }
        setAllTransactions(loadedTransactions);
      } else {
        setAllTransactions([]);
      }
      setIsLoading(false);
    };
    
    const errorCallback = (error: Error) => { 
      console.error("[TransactionHistoryTab] Error fetching transactions with onValue:", error);
      toast({ title: "Error", description: "Could not load transaction history in real-time.", variant: "destructive" });
      setIsLoading(false);
    };

    onValue(query(transactionsRef), listenerCallback, errorCallback);

    return () => {
      off(transactionsRef, 'value', listenerCallback);
      processedRefundsRef.current.clear(); 
    };

  }, [authUserUid, toast]);

  useEffect(() => {
    let currentFiltered = [...allTransactions];

    if (dateRange?.from) {
      currentFiltered = currentFiltered.filter(tx => tx.date >= dateRange.from!.getTime());
    }
    if (dateRange?.to) {
      const endOfDayTo = new Date(dateRange.to);
      endOfDayTo.setHours(23, 59, 59, 999);
      currentFiltered = currentFiltered.filter(tx => tx.date <= endOfDayTo.getTime());
    }
    
    if (statusFilter !== 'all') {
      currentFiltered = currentFiltered.filter(tx => tx.status.toLowerCase() === statusFilter.toLowerCase());
    }
    
    setFilteredTransactions(currentFiltered);
  }, [allTransactions, dateRange, statusFilter]);


  const getStatusBadgeVariant = (status: TransactionStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Approved':
      case 'Earned':
        return 'default'; 
      case 'Pending':
        return 'secondary'; 
      case 'Rejected':
        return 'destructive'; 
      default:
        return 'outline';
    }
  };
   const getStatusBadgeClass = (status: TransactionStatus): string => {
    switch (status) {
      case 'Approved':
      case 'Earned':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Rejected':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handleRowClick = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setWithdrawalRequestDetails(null); // Reset previous details
    setIsDetailModalOpen(true);

    if (transaction.type === 'withdrawal' && transaction.withdrawalRequestId && authUserUid) {
      setIsLoadingModalDetails(true);
      try {
        const requestRef = ref(database, `withdrawalRequests/${authUserUid}/${transaction.withdrawalRequestId}`);
        const snapshot = await get(requestRef);
        if (snapshot.exists()) {
          setWithdrawalRequestDetails({ id: snapshot.key, ...snapshot.val() } as WithdrawalRequest);
        } else {
          console.warn("Withdrawal request details not found for ID:", transaction.withdrawalRequestId);
          toast({ title: "Details Not Found", description: "Associated withdrawal request details could not be found.", variant: "default" });
        }
      } catch (error) {
        console.error("Error fetching withdrawal request details:", error);
        toast({ title: "Error", description: "Could not fetch withdrawal request details.", variant: "destructive" });
      } finally {
        setIsLoadingModalDetails(false);
      }
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Transaction History</CardTitle>
            <CardDescription>View all your earnings and withdrawal activities. Updates in real-time. Click a row for details.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[260px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="earned">Earned</SelectItem>
                <SelectItem value="pending">Pending (Withdrawal)</SelectItem>
                <SelectItem value="approved">Approved (Withdrawal)</SelectItem>
                <SelectItem value="rejected">Rejected (Withdrawal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Notes/Ref ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow 
                    key={tx.id} 
                    onClick={() => handleRowClick(tx)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>{format(new Date(tx.date), "PP pp")}</TableCell>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell className={cn("text-right font-semibold", tx.type === 'earning' ? 'text-green-600' : 'text-red-600')}>
                      {tx.type === 'earning' ? '+' : ''}{tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant={getStatusBadgeVariant(tx.status)} className={getStatusBadgeClass(tx.status)}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.notes || tx.id?.substring(0,10) || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="text-center py-10">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions found for the selected filters.</p>
                 {allTransactions.length === 0 && <p className="text-sm text-muted-foreground mt-1">You have no transaction history yet.</p>}
              </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Developer Note: Refund for rejected withdrawals is simulated on the client-side for demonstration.
        A robust production system requires backend listeners for such operations.
      </p>

      {selectedTransaction && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Info size={20}/>Transaction Details</DialogTitle>
              <DialogDescription>
                Detailed view of transaction ID: <span className="font-mono text-xs">{selectedTransaction.id}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3 text-sm">
              <div className="flex justify-between"><span>Date:</span> <span>{format(new Date(selectedTransaction.date), "PPP ppp")}</span></div>
              <div className="flex justify-between"><span>Description:</span> <span className="text-right">{selectedTransaction.description}</span></div>
              <div className="flex justify-between"><span>Amount:</span> <span className={cn(selectedTransaction.type === 'earning' ? 'text-green-600' : 'text-red-600', "font-semibold")}>₹{selectedTransaction.type === 'earning' ? '+' : ''}{selectedTransaction.amount.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Type:</span> <span className="capitalize">{selectedTransaction.type}</span></div>
              <div className="flex justify-between items-center"><span>Status:</span> <Badge variant={getStatusBadgeVariant(selectedTransaction.status)} className={getStatusBadgeClass(selectedTransaction.status)}>{selectedTransaction.status}</Badge></div>
              {selectedTransaction.notes && <div className="flex justify-between"><span>Notes:</span> <span className="text-xs text-muted-foreground text-right">{selectedTransaction.notes}</span></div>}
              
              {isLoadingModalDetails && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" /> Loading withdrawal details...
                </div>
              )}

              {!isLoadingModalDetails && selectedTransaction.type === 'withdrawal' && withdrawalRequestDetails && (
                <>
                  <hr className="my-2"/>
                  <p className="font-semibold text-foreground">Withdrawal Information:</p>
                  <div className="flex justify-between"><span>Method:</span> <span className="capitalize">{withdrawalRequestDetails.method}</span></div>
                  {Object.entries(withdrawalRequestDetails.details).map(([key, value]) => (
                     <div className="flex justify-between" key={key}><span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span> 
                     <span className="text-right break-all">{String(value)}</span></div>
                  ))}
                  {selectedTransaction.status === 'Rejected' && withdrawalRequestDetails.adminNotes && (
                     <div className="p-2 bg-red-50 border border-red-200 rounded-md mt-2">
                        <p className="font-semibold text-red-700">Rejection Reason:</p>
                        <p className="text-red-600">{withdrawalRequestDetails.adminNotes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

