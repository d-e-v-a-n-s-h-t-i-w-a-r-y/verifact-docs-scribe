import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Mic,
  FileText,
  Settings as SettingsIcon,
  Lock,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  ChevronDown,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/consultations/new", label: "New Consultation", icon: Mic },
  { to: "/notes", label: "Note History", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <Stethoscope className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="font-serif text-lg tracking-tight text-foreground">Verifact</span>
          )}
        </div>

        <nav className="flex-1 px-2 py-2">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 flex items-center justify-center gap-2 rounded-md border border-border py-2 text-xs text-muted-foreground hover:bg-muted"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : (
            <>
              <ChevronLeft className="h-3.5 w-3.5" /> Collapse
            </>
          )}
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

export function TopBar({
  title,
  extras,
}: {
  title: string;
  extras?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/90 px-6 backdrop-blur">
      <h1 className="font-serif text-xl tracking-tight text-foreground truncate">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {extras}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-foreground">
          <Lock className="h-3 w-3 text-accent" />
          <span className="hidden sm:inline">Local processing</span>
        </div>
        <ProfileChip />
      </div>
    </header>
  );
}

function ProfileChip() {
  const [open, setOpen] = useState<null | "profile" | "compliance" | "logout">(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5 text-sm hover:bg-muted">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            AR
          </span>
          <span className="hidden text-sm font-medium sm:inline">Dr. Aisha Raman</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setOpen("profile")}>
            <User className="mr-2 h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpen("compliance")}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Compliance Info
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen("logout")}>
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open === "profile"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dr. Aisha Raman</DialogTitle>
            <DialogDescription>Internal Medicine · Signing clinician</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-border py-2"><span className="text-muted-foreground">GMC / registration</span><span>7412093</span></div>
            <div className="flex justify-between border-b border-border py-2"><span className="text-muted-foreground">Signature</span><span>Aisha Raman, MD</span></div>
            <div className="flex justify-between py-2"><span className="text-muted-foreground">Default template</span><span>OPD Note</span></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "compliance"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4 text-accent" />Compliance status</DialogTitle>
            <DialogDescription>All processing runs on this workstation.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            <li className="flex justify-between px-3 py-2"><span className="text-muted-foreground">Model runtime</span><span>On-device v3.2</span></li>
            <li className="flex justify-between px-3 py-2"><span className="text-muted-foreground">Cloud calls</span><span>None</span></li>
            <li className="flex justify-between px-3 py-2"><span className="text-muted-foreground">Audio retention</span><span>Deleted after sign-off</span></li>
            <li className="flex justify-between px-3 py-2"><span className="text-muted-foreground">Audit log</span><span>Local, encrypted</span></li>
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "logout"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out of Verifact?</DialogTitle>
            <DialogDescription>Any unsigned drafts remain on this device.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setOpen(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <button
              onClick={() => {
                setOpen(null);
                toast.success("Signed out (demo)");
              }}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Log out
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
