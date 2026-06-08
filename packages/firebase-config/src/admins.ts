export const SUPER_ADMIN_EMAILS = ["chanjinxian110@1utar.my"];

export const ADMIN_EMAILS = [
  "admin1@gmail.com",
  "admin2@gmail.com",
  ...SUPER_ADMIN_EMAILS,
];

export const isAdmin = (email: string): boolean => ADMIN_EMAILS.includes(email);
export const isSuperAdmin = (email: string): boolean => SUPER_ADMIN_EMAILS.includes(email);
