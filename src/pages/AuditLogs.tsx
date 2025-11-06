import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Navbar } from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AuditLogs() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/auth');
      } else {
        setUser(user);
      }
    });
  }, [navigate]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('delete')) return 'destructive';
    if (action.includes('create') || action.includes('placed')) return 'default';
    if (action.includes('update')) return 'secondary';
    return 'outline';
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onSignOut={handleSignOut} />
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading audit logs...</div>
            ) : logs && logs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource Type</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeColor(log.action)}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.resource_type}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.user_id ? log.user_id.substring(0, 8) + '...' : 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.ip_address || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No audit logs found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
