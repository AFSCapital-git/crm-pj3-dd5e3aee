import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Building2, FileText, FolderKanban, Calendar, Users, Mail, Bot } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "@/lib/auth.functions";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Empresas", url: "/empresas", icon: Building2 },
  { title: "Editais FINEP", url: "/editais", icon: FileText },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Cronograma", url: "/cronograma", icon: Calendar },
  { title: "E-mails a vincular", url: "/emails-nao-vinculados", icon: Mail },
  { title: "Assistente IA", url: "/insights", icon: Bot },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => pathname === u || pathname.startsWith(u + "/");
  const fetchMe = useServerFn(getCurrentUser);
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const isAdmin = me.data?.role === "admin";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/usuarios")}>
                    <Link to="/usuarios" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {me.data && (
          <SidebarGroup>
            <SidebarGroupLabel>Sessão</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 py-2 text-xs text-sidebar-foreground/80">
                <div className="font-medium truncate">{me.data.nome}</div>
                <div className="uppercase tracking-wide text-[10px] mt-1 text-sidebar-foreground/60">
                  {me.data.role ?? "sem papel"}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
