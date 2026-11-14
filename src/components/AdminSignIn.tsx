"use client";

import { SubmitEvent, useState } from "react";
import { useRouter } from "next/navigation";
// import { signIn as signInAuth } from "@/lib/auth-client";

const AdminSignIn = () => {
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const signIn = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // setIsLoading(true);

    // const formData = new FormData(event.currentTarget);
    // const email = formData.get("email") as string;
    // const password = formData.get("password") as string;

    // try {
    //   await signInAuth.email({
    //     email: email as string,
    //     password: password as string
    //   });
    //   router.push("/admin");
    // } catch (error) {
    //   console.error("Sign-in failed:", error);
    //   alert("Sign-in failed. Please check your credentials and try again.");
    // } finally {
    //   setIsLoading(false);
    // }
  }
  
  return (
    <div>
      <div className="content-header">
        Welcome back.
      </div>
      <div className="content-body">
        <form onSubmit={signIn}>
          <div>
            <input type="email" name="email" placeholder="Email" required />
          </div>
          <div>
            <input type="password" name="password" placeholder="Password" required />
          </div>
          <div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
};

export default AdminSignIn;