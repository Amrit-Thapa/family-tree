export type Role = "viewer" | "editor";

export const rolePermissions: Record<Role, string[]> = {
  viewer: ["read"],
  editor: ["read", "write"],
};

export const canWrite = (role: Role) => rolePermissions[role].includes("write");
