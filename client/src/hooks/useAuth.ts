import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Transform user data to ensure roles is properly formatted
  const transformedUser = user ? {
    ...user,
    roles: user.roles || "team_member" // Ensure roles field exists
  } : null;

  return {
    user: transformedUser,
    isLoading,
    isAuthenticated: !!user,
  };
}
