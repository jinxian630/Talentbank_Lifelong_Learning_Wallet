export const ADMIN_EMAILS = [
  "admin1@gmail.com",
  "admin2@gmail.com",
  "chanjinxian110@gmail.com",
];

export const isAdmin = (email: string): boolean => ADMIN_EMAILS.includes(email);
