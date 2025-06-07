
"use client";

import { useEffect, useState } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import type { WithdrawalRequest, TransactionStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DisplayWithdrawalRequest extends WithdrawalRequest {
  originalId: string;
}

interface UserWithdrawalRequests {
  userId: string;
  requests: DisplayWithdrawalRequest[];
}

const ADMIN_EMAIL = "admin@devifyo.com";
const ADMIN_PASSWORD = "pass@admin";

export default function AdminPage() {
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [allRequests, setAllRequests] = useState<UserWithdrawalRequests[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [currentRequestToReject, setCurrentRequestToReject] = useState<DisplayWithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticatedAdmin) {
      setIsLoading(false); // Don't load requests if not authenticated
      return;
    }

    const fetchWithdrawalRequests = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const withdrawalRequestsRef = ref(database, 'withdrawalRequests');
        const snapshot = await get(withdrawalRequestsRef);
        if (snapshot.exists()) {
          const usersData = snapshot.val();
          const loadedRequests: UserWithdrawalRequests[] = [];
          for (const userId in usersData) {
            const userRequestsData = usersData[userId];
            const userRequestsList: DisplayWithdrawalRequest[] = [];
            for (const reqId in userRequestsData) {
              userRequestsList.push({
                ...userRequestsData[reqId],
                userId: userId,
                originalId: reqId,
              });
            }
            if (userRequestsList.length > 0) {
              loadedRequests.push({ userId, requests: userRequestsList.sort((a,b) => b.requestDate - a.requestDate) });
            }
          }
          setAllRequests(loadedRequests.sort((a,b) => {
            const lastReqA = a.requests[0]?.requestDate || 0;
            const lastReqB = b.requests[0]?.requestDate || 0;
            return lastReqB - lastReqA;
          }));
        } else {
          setAllRequests([]);
        }
      } catch (err) {
        console.error("Error fetching withdrawal requests:", err);
        setError("Failed to load withdrawal requests.");
        toast({ title: "Error", description: "Could not fetch requests.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchWithdrawalRequests();
  }, [toast, isAuthenticatedAdmin]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput === ADMIN_EMAIL && passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticatedAdmin(true);
      setAuthError(null);
      sessionStorage.setItem('isAdminAuthenticated_drawly', 'true'); // Basic session persistence
    } else {
      setAuthError("Invalid email or password.");
      setIsAuthenticatedAdmin(false);
    }
  };

  useEffect(() => {
    // Check session storage on component mount
    if (sessionStorage.getItem('isAdminAuthenticated_drawly') === 'true') {
      setIsAuthenticatedAdmin(true);
    }
  }, []);


  const updateRequestAndTransactionStatus = async (
    userId: string,
    requestId: string,
    transactionId: string | undefined,
    newStatus: 'Approved' | 'Rejected',
    adminNotes?: string
  ) => {
    setProcessingAction(`${userId}_${requestId}`);
    try {
      const requestUpdates: Partial<WithdrawalRequest> = {
        status: newStatus,
        processedDate: serverTimestamp() as number,
      };
      if (adminNotes) {
        requestUpdates.adminNotes = adminNotes;
      }
      await update(ref(database, `withdrawalRequests/${userId}/${requestId}`), requestUpdates);

      if (transactionId) {
        await update(ref(database, `transactions/${userId}/${transactionId}`), { status: newStatus });
      } else {
        toast({ title: "Warning", description: `Transaction ID missing for request ${requestId}. Transaction status not updated.`, variant: "default" });
      }
      
      toast({ title: "Success", description: `Request ${requestId} has been ${newStatus.toLowerCase()}.` });
      
      setAllRequests(prev => prev.map(userReqs => {
        if (userReqs.userId === userId) {
          return {
            ...userReqs,
            requests: userReqs.requests.map(req => 
              req.originalId === requestId ? { ...req, status: newStatus, adminNotes: adminNotes || req.adminNotes } : req
            )
          };
        }
        return userReqs;
      }));

    } catch (err) {
      console.error(`Error updating request ${requestId} to ${newStatus}:`, err);
      toast({ title: "Error", description: `Failed to update request ${requestId}.`, variant: "destructive" });
    } finally {
      setProcessingAction(null);
      if (newStatus === 'Rejected') {
        setIsRejectDialogOpen(false);
        setRejectionReason('');
        setCurrentRequestToReject(null);
      }
    }
  };

  const handleApprove = (request: DisplayWithdrawalRequest) => {
    updateRequestAndTransactionStatus(request.userId, request.originalId, request.transactionId, 'Approved');
  };

  const openRejectDialog = (request: DisplayWithdrawalRequest) => {
    setCurrentRequestToReject(request);
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (currentRequestToReject && rejectionReason.trim()) {
      updateRequestAndTransactionStatus(
        currentRequestToReject.userId,
        currentRequestToReject.originalId,
        currentRequestToReject.transactionId,
        'Rejected',
        rejectionReason.trim()
      );
    } else if (!rejectionReason.trim()) {
        toast({ title: "Validation Error", description: "Rejection reason cannot be empty.", variant: "destructive"});
    }
  };

 const getStatusBadgeClass = (status: WithdrawalRequest['status']): string => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Rejected':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (!isAuthenticatedAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              <div>
                <strong>Security Notice:</strong> This login is a PROTOTYPE and NOT secure.
                Do NOT use real credentials or rely on this for production security.
              </div>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <Label htmlFor="adminEmail">Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@devifyo.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="adminPassword">Password</Label>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="pass@admin"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {authError && <p className="text-sm text-destructive">{authError}</p>}
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="text-center text-destructive p-4 bg-destructive/10 rounded-md flex items-center justify-center gap-2"><AlertTriangle /> {error}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">Withdrawal Requests Management</h2>
      
      {allRequests.length === 0 ? (
        <p className="text-muted-foreground">No withdrawal requests found.</p>
      ) : (
        allRequests.map(userReqs => (
          <div key={userReqs.userId} className="mb-8 p-4 border rounded-lg shadow-sm bg-card">
            <h3 className="text-lg font-medium mb-3 text-card-foreground">User ID: <span className="font-mono text-sm bg-muted p-1 rounded">{userReqs.userId}</span></h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Req ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userReqs.requests.map((req) => (
                  <TableRow key={req.originalId}>
                    <TableCell className="text-xs font-mono">{req.originalId.substring(0,10)}...</TableCell>
                    <TableCell>{format(new Date(req.requestDate), "PP pp")}</TableCell>
                    <TableCell className="font-semibold">₹{req.amount.toFixed(2)}</TableCell>
                    <TableCell>{req.method.toUpperCase()}</TableCell>
                    <TableCell className="text-xs">
                      {Object.entries(req.details).map(([key, value]) => (
                        <div key={key}><strong>{key}:</strong> {String(value)}</div>
                      ))}
                      {req.adminNotes && <div className="mt-1 text-red-600"><strong>Admin:</strong> {req.adminNotes}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", getStatusBadgeClass(req.status))}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {req.status === 'Pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleApprove(req)}
                            disabled={processingAction === `${req.userId}_${req.originalId}`}
                          >
                            {processingAction === `${req.userId}_${req.originalId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => openRejectDialog(req)}
                            disabled={processingAction === `${req.userId}_${req.originalId}`}
                          >
                            {processingAction === `${req.userId}_${req.originalId}` && currentRequestToReject?.originalId !== req.originalId ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this withdrawal request. This will be saved as admin notes.
              User: {currentRequestToReject?.userId}, Amount: ₹{currentRequestToReject?.amount.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="rejectionReason">Rejection Reason</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Insufficient details, suspected activity, etc."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setIsRejectDialogOpen(false); setRejectionReason(''); setCurrentRequestToReject(null);}} disabled={processingAction === `${currentRequestToReject?.userId}_${currentRequestToReject?.originalId}`}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReject} 
              disabled={!rejectionReason.trim() || processingAction === `${currentRequestToReject?.userId}_${currentRequestToReject?.originalId}`}
              variant="destructive"
            >
              {processingAction === `${currentRequestToReject?.userId}_${currentRequestToReject?.originalId}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
    

    
