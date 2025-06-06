
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Filter, AlertTriangle, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, get, query /* Removed orderByChild */ } from 'firebase/database';
import type { Transaction, TransactionStatus } from '@/lib/types';
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
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'earned', 'pending', 'approved', 'rejected'

  useEffect(() => {
    if (!authUserUid) {
      setIsLoading(false);
      return;
    }
    const transactionsRef = ref(database, `transactions/${authUserUid}`);
    // Removed orderByChild('date') from the query. Client-side sort will handle ordering.
    get(query(transactionsRef)).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedTransactions: Transaction[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => b.date - a.date); // Sort descending by date (client-side)
        setAllTransactions(loadedTransactions);
        setFilteredTransactions(loadedTransactions); // Initially show all
      } else {
        setAllTransactions([]);
        setFilteredTransactions([]);
      }
      setIsLoading(false);
    }).catch(error => {
      console.error("Error fetching transactions:", error);
      toast({ title: "Error", description: "Could not load transaction history.", variant: "destructive" });
      setIsLoading(false);
    });
  }, [authUserUid, toast]);

  useEffect(() => {
    let currentFiltered = [...allTransactions];

    // Filter by date
    if (dateRange?.from) {
      currentFiltered = currentFiltered.filter(tx => tx.date >= dateRange.from!.getTime());
    }
    if (dateRange?.to) {
       // Set to to end of day for inclusive range
      const endOfDayTo = new Date(dateRange.to);
      endOfDayTo.setHours(23, 59, 59, 999);
      currentFiltered = currentFiltered.filter(tx => tx.date <= endOfDayTo.getTime());
    }
    
    // Filter by status
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
        return '';
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
            <CardDescription>View all your earnings and withdrawal activities.</CardDescription>
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
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
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
                    <TableCell className="text-xs text-muted-foreground">{tx.notes || 'N/A'}</TableCell>
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
    </div>
  );
}

