"use client";

import { SubmitEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn as signInAuth } from "@/lib/auth-client";

const AdminSignIn = () => {
  
  return (
    <div>
      <div className="content-header">
        Welcome back.
      </div>
      <div className="content-body">
        Content
      </div>
    </div>
  )
};

export default AdminSignIn;