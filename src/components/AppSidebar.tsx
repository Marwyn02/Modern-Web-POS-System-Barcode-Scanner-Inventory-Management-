import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  LogOut,
  History,
  BookOpen,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar(); // add setOpenMobile
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const showText = isMobile ? true : !collapsed;
  const {
    isAdmin,
    isCashier,
    isStoreClerk,
    canAccessDashboard,
    canAccessSales,
    canAccessInventory,
    canAccessBookkeeping,
    canAccessEmployees,
    canAccessReports,
  } = useUserRole();

  // rest of your code stays the same...

  const roleLabel = isAdmin
    ? "Manager"
    : isStoreClerk
      ? "Store Clerk"
      : isCashier
        ? "Cashier"
        : "User";

  const navItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      visible: canAccessDashboard,
    },
    {
      title: "Sales",
      url: "/sales",
      icon: ShoppingCart,
      visible: canAccessSales,
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: History,
      visible: canAccessSales,
    },
    {
      title: "Inventory",
      url: "/inventory",
      icon: Package,
      visible: canAccessInventory,
    },
    {
      title: "Employees",
      url: "/employees",
      icon: Users,
      visible: canAccessEmployees,
    },
    {
      title: "Bookkeeping",
      url: "/bookkeeping",
      icon: BookOpen,
      visible: canAccessBookkeeping,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      visible: canAccessReports,
    },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground">
                GroceryPOS
              </h2>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems
                .filter((item) => item.visible)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onClick={() => {
                          if (isMobile) setOpenMobile(false); // close on mobile nav click
                        }}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {showText && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size={!showText ? "icon" : "default"}
          onClick={handleLogout}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {showText && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
