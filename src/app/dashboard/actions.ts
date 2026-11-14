"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  return session.user.id;
}

export async function addContact(formData: FormData) {
  const userId = await getUserId();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("A contact name is required.");

  await db.contact.create({
    data: {
      name,
      email: email || null,
      company: company || null,
      notes: notes || null,
      userId,
    },
  });

  revalidatePath("/dashboard");
}

export async function deleteContact(formData: FormData) {
  const userId = await getUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A contact id is required.");

  await db.contact.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard");
}
