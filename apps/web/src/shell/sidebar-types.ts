export type SidebarItem = {
  label: string;
  href?: string;
  active?: boolean;
  nested?: boolean;
  badge?: string;
  alert?: boolean;
};

export type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};
