export type LeadIdentityGroup<T> = {
  key: string;
  primary: T;
  instances: T[];
};

const normalizedPhone = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? digits : "";
};

const normalizedEmail = (value: unknown) => String(value || "").trim().toLowerCase();

export function groupLeadsByIdentity<T extends { id: string; phone?: unknown; email?: unknown; created_at?: unknown }>(leads: T[]): LeadIdentityGroup<T>[] {
  const parent = leads.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  const phoneOwners = new Map<string, number>();
  const emailOwners = new Map<string, number>();

  leads.forEach((lead, index) => {
    const phone = normalizedPhone(lead.phone);
    const email = normalizedEmail(lead.email);
    if (phone) {
      if (phoneOwners.has(phone)) join(index, phoneOwners.get(phone)!);
      else phoneOwners.set(phone, index);
    }
    if (email) {
      if (emailOwners.has(email)) join(index, emailOwners.get(email)!);
      else emailOwners.set(email, index);
    }
  });

  const grouped = new Map<number, T[]>();
  leads.forEach((lead, index) => {
    const root = find(index);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root)!.push(lead);
  });

  return Array.from(grouped.entries()).map(([root, groupInstances]) => {
    const instances = [...groupInstances].sort((left, right) => new Date(String(right.created_at || 0)).getTime() - new Date(String(left.created_at || 0)).getTime());
    return { key: `person:${leads[root]?.id || instances[0].id}`, primary: instances[0], instances };
  }).sort((left, right) => new Date(String(right.primary.created_at || 0)).getTime() - new Date(String(left.primary.created_at || 0)).getTime());
}
