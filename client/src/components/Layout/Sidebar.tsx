import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Building2, 
  Calendar, 
  Package, 
  Users, 
  BarChart3,
  Settings,
  ChevronRight,
  Shield
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Clients",
    href: "/clients", 
    icon: Building2,
  },
  {
    title: "Services",
    href: "/services",
    icon: Calendar,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
  },
  {
    title: "Teams",
    href: "/teams",
    icon: Users,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "Users",
    href: "/users",
    icon: Shield,
  },
];

export default function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            ACG Works
          </h2>
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = location === item.href || 
                (item.href !== "/" && location.startsWith(item.href));
                
              return (
                <Link key={item.href} href={item.href}>
                  <a
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                      isActive 
                        ? "bg-accent text-accent-foreground" 
                        : "transparent"
                    )}
                    data-testid={`sidebar-link-${item.title.toLowerCase()}`}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                    {isActive && (
                      <ChevronRight className="ml-auto h-4 w-4" />
                    )}
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
