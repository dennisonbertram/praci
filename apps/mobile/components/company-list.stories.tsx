import { CompanyList } from "./company-list";

export default { title: "Company/Native list", component: CompanyList };
export const Empty = { args: { rows: [] } };
export const Full = {
  args: {
    rows: [
      { id: "company", title: "Northwind Robotics", detail: "Reconstructed", onPress: () => {} },
      { id: "person", title: "Alex Reed", detail: "Engineer · 2024 Q2 – 2025", onPress: () => {} },
    ],
  },
};
export const Review = {
  args: {
    rows: [
      {
        id: "review",
        title: "Alex Reed",
        detail: "Not confirmed",
        onPress: () => {},
        onConfirm: () => {},
        onReject: () => {},
      },
    ],
  },
};
export const Running = {
  args: { rows: [{ id: "source", title: "Gmail", detail: "Reading · 12 / 25 items" }] },
};
export const Partial = {
  args: { rows: [{ id: "source", title: "Data room", detail: "Failed · 12 items · 4 facts" }] },
};
