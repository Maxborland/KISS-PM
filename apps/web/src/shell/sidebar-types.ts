export type SidebarItem = {
  label: string;
  active?: boolean;
  nested?: boolean;
  badge?: string;
  alert?: boolean;
};

export type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};
