import { createAuthClient } from 'better-auth/react';
import { adminClient } from "better-auth/client/plugins";

export const {
  changeEmail,
  signIn,
  signUp,
  signOut,
  updateUser,
  useSession
} = createAuthClient({
  plugins: [
    adminClient()
  ]
})