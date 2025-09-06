import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { canCreateUser } from "@/lib/permissions";
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

export default function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  // Check if user has management permissions
  console.log("Current user in sidebar:", user);
  console.log("User roles:", user?.roles);
  
  const hasUserManagementPermission = user?.roles && 
    (user.roles.includes("super_user") || user.roles.includes("general_manager"));
  
  console.log("Has user management permission:", hasUserManagementPermission);

  const navigation = [
    { 
      name: "Dashboard", 
      href: "/", 
      icon: LayoutDashboard,
      current: location === "/"
    },
    { 
      name: "Clients", 
      href: "/clients", 
      icon: Building2,
      current: location === "/clients"
    },
    { 
      name: "Services", 
      href: "/services", 
      icon: Calendar,
      current: location === "/services"
    },
    { 
      name: "Inventory", 
      href: "/inventory", 
      icon: Package,
      current: location === "/inventory"
    },
    { 
      name: "Teams", 
      href: "/teams", 
      icon: Users,
      current: location === "/teams"
    },
    ...(hasUserManagementPermission ? [{
      name: "Users",
      href: "/users", 
      icon: Shield,
      current: location === "/users"
    }] : []),
    { 
      name: "Reports", 
      href: "/reports", 
      icon: BarChart3,
      current: location === "/reports"
    },
  ];

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            ACG Works
          </h2>
          <div className="space-y-1">
            {navigation.map((item) => {
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
                    data-testid={`sidebar-link-${item.name.toLowerCase()}`}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.name}</span>
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

      {/* Settings section - only show for super_user or general_manager */}
      {user && hasUserManagementPermission && (
        <div className="px-3 py-2">
          <div className="space-y-1">
            <Link href="/settings">
              <a
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  location === "/settings" && "bg-accent text-accent-foreground"
                )}
                data-testid="sidebar-link-settings"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
                {location === "/settings" && (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </a>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}