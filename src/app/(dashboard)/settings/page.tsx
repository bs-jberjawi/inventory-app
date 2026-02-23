"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, UserPlus, Shield, Loader2, Mail } from "lucide-react";
import { format } from "date-fns";
import type { UserRole } from "@/lib/types/database";

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export default function SettingsPage() {
  const { role, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("manager");
  const [inviting, setInviting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users);
    } catch (err) {
      toast.error(
        "Failed to load users: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === "admin") {
      fetchUsers();
    }
  }, [role, fetchUsers]);

  // Redirect non-admins via effect to avoid breaking Rules of Hooks
  useEffect(() => {
    if (!authLoading && role !== "admin") {
      router.replace("/");
    }
  }, [authLoading, role, router]);

  // Show nothing while auth is loading or redirecting non-admins
  if (authLoading || role !== "admin") {
    return null;
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("manager");
      setInviteOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(
        "Failed to invite user: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Role updated successfully");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      toast.error(
        "Failed to update role: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  const roleBadgeVariant = (r: UserRole) => {
    switch (r) {
      case "admin":
        return "default" as const;
      case "manager":
        return "secondary" as const;
      case "viewer":
        return "outline" as const;
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Settings
          </h2>
          <p className="text-muted-foreground">
            Manage users and system settings.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Invite new users and manage their roles. Users receive an email
              invitation to set up their account.
            </CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an email invitation to a new user. They&apos;ll receive a
                  link to set up their password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v: string) => setInviteRole(v as UserRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    <strong>Admin:</strong> Full access including user
                    management. <strong>Manager:</strong> Can manage inventory.{" "}
                    <strong>Viewer:</strong> Read-only access.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                >
                  {inviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Sign In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {u.full_name || (u.email_confirmed_at ? u.email : "Pending")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {u.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.id === user?.id ? (
                        <Badge variant={roleBadgeVariant(u.role)}>
                          {u.role} (you)
                        </Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(v: string) =>
                            handleRoleChange(u.id, v as UserRole)
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.email_confirmed_at ? "default" : "secondary"
                        }
                      >
                        {u.email_confirmed_at ? "Active" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(u.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in_at
                        ? format(
                            new Date(u.last_sign_in_at),
                            "MMM d, yyyy HH:mm"
                          )
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
