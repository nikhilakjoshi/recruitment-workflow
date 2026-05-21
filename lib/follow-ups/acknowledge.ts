import { prisma } from "@/lib/db";

export async function acknowledgeFollowUp(followUpId: string): Promise<void> {
  await prisma.followUp.update({
    where: { id: followUpId },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
}
