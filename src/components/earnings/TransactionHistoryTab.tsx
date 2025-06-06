
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Filter, AlertTriangle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from '@/lib/utils';

type TransactionStatus = 'Pending' | 'Approved' | 'Rejected' | 'Earned';
interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'earning' | 'withdrawal';
  status: TransactionStatus;
  notes?: string;
}

// Mock data for demonstration
const mockTransactions: Transaction[] = [
  { id: 'txn1', date: subDays(new Date(), 1), description: 'Earnings from Alice Wonderland', amount: 10.00, type: 'earning', status: 'Earned' },
  { id: 'txn2', date: subDays(new Date(), 2), description: 'Withdrawal Request (UPI)', amount: -50.00, type: 'withdrawal', status: 'Approved', notes: 'Processed successfully' },
  { id: 'txn3', date: subDays(new Date(), 3), description: 'Earnings from Bob The Builder', amount: 5.00, type: 'earning', status: 'Earned' },
  { id: 'txn4', date: subDays(new Date(), 5), description: 'Withdrawal Request (Bank)', amount: -100.00, type: 'withdrawal', status: 'Pending' },
  { id: 'txn5', date: subDays(new Date(), 7), description: 'Earnings from Diana Prince', amount: 15.00, type: 'earning', status: 'Earned' },
  { id: 'txn6', date: subDays(new Date(), 10), description: 'Withdrawal Request (Paytm)', amount: -70.00, type: 'withdrawal', status: 'Rejected', notes: 'Invalid Paytm details' },
  { id: 'txn7', date: subDays(new Date(), 12), description: 'Earnings from Alice Wonderland', amount: 8.00, type: 'earning', status: 'Earned' },
];


export default function TransactionHistoryTab() {
  // In a real app, this data would come from an API call
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Basic filtering (would be done server-side in a real app)
  const filteredTransactions = transactions.filter(tx => {
    const dateMatches = dateRange?.from && dateRange?.to ? 
                        (tx.date >= dateRange.from && tx.date <= dateRange.to) : true;
    const statusMatches = statusFilter === 'all' ? true : tx.status.toLowerCase() === statusFilter.toLowerCase();
    return dateMatches && statusMatches;
  });

  const getStatusBadgeVariant = (status: TransactionStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Approved':
      case 'Earned':
        return 'default'; // Greenish
      case 'Pending':
        return 'secondary'; // Bluish/Yellowish
      case 'Rejected':
        return 'destructive'; // Reddish
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
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
                    <TableCell>{format(tx.date, "PP")}</TableCell>
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
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your date range or status filter.</p>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
