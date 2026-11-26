import { t } from "@lingui/core/macro";
import type {
  EquityCustomProperty,
  EquityStakeholderDetail,
  EquityStakeholderType,
} from "@rakazo/contracts";
import { EQUITY_RELATIONSHIP_LABELS, EQUITY_RELATIONSHIPS } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

type Form = {
  type: EquityStakeholderType;
  firstName: string;
  lastName: string;
  name: string;
  contactEmail: string;
  portfolioEmail: string;
  dateOfBirth: string;
  taxId: string;
  employeeId: string;
  country: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  relationship: string;
  startDate: string;
  custom: Record<string, string>;
};

function initial(stakeholder?: EquityStakeholderDetail): Form {
  const address = stakeholder?.addresses[0];
  return {
    type: stakeholder?.type ?? "individual",
    firstName: stakeholder?.firstName ?? "",
    lastName: stakeholder?.lastName ?? "",
    name: stakeholder?.name ?? "",
    contactEmail: stakeholder?.contactEmail ?? "",
    portfolioEmail: stakeholder?.portfolioEmail ?? "",
    dateOfBirth: stakeholder?.dateOfBirth ?? "",
    taxId: stakeholder?.taxId ?? "",
    employeeId: stakeholder?.employeeId ?? "",
    country: address?.country ?? "",
    street: address?.street ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postalCode: address?.postalCode ?? "",
    relationship: "",
    startDate: today(),
    custom: { ...(stakeholder?.customValues ?? {}) },
  };
}

const orNull = (value: string) => value.trim() || null;

/** The create or update input the form describes. */
export function formInput(form: Form) {
  const individual = form.type === "individual";
  const name = individual
    ? [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ")
    : form.name.trim();
  const address = {
    country: orNull(form.country),
    street: orNull(form.street),
    city: orNull(form.city),
    state: orNull(form.state),
    postalCode: orNull(form.postalCode),
  };
  return {
    type: form.type,
    name,
    firstName: individual ? orNull(form.firstName) : null,
    lastName: individual ? orNull(form.lastName) : null,
    contactEmail: orNull(form.contactEmail),
    portfolioEmail: orNull(form.portfolioEmail),
    dateOfBirth: individual ? orNull(form.dateOfBirth) : null,
    taxId: orNull(form.taxId),
    employeeId: orNull(form.employeeId),
    addresses: Object.values(address).some(Boolean) ? [address] : [],
    customValues: Object.fromEntries(
      Object.entries(form.custom).filter(([, value]) => value.trim()),
    ),
  };
}

export type StakeholderFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeholder?: EquityStakeholderDetail;
  customProperties: EquityCustomProperty[];
  onSaved: (stakeholder: EquityStakeholderDetail) => void;
};

/** Add one stakeholder, or edit one. */
export function StakeholderFormDialog({
  open,
  onOpenChange,
  stakeholder,
  customProperties,
  onSaved,
}: StakeholderFormDialogProps) {
  const [form, setForm] = useState(() => initial(stakeholder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // One key per dialog open, so a retry after a lost response adds the stakeholder once.
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (open) {
      requestKey.current = crypto.randomUUID();
      setForm(initial(stakeholder));
      setError("");
    }
  }, [open, stakeholder]);

  const set = (field: keyof Form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
  const input = formInput(form);
  const editing = Boolean(stakeholder);
  const individual = form.type === "individual";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.name) return setError(t`Enter a name`);
    setSaving(true);
    setError("");
    try {
      const { portfolioEmail, ...rest } = input;
      const saved = stakeholder
        ? await rpc.equity.stakeholders.update({
            id: stakeholder.id,
            ...rest,
            ...(stakeholder.portfolioEmailLocked ? {} : { portfolioEmail }),
          })
        : await rpc.equity.stakeholders.create({
            ...input,
            requestKey: requestKey.current,
            properties: form.relationship
              ? [
                  {
                    kind: "relationship",
                    effectiveDate: form.startDate || today(),
                    value: form.relationship,
                  },
                ]
              : [],
          });
      onSaved(saved);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const field = (
    id: keyof Form,
    label: string,
    props: { type?: string; disabled?: boolean } = {},
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`stakeholder-${id}`}>{label}</Label>
      <Input id={`stakeholder-${id}`} value={form[id] as string} onChange={set(id)} {...props} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? t`Edit stakeholder` : t`Add stakeholder`}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stakeholder-type">{t`Type`}</Label>
            <NativeSelect id="stakeholder-type" value={form.type} onChange={set("type")}>
              <NativeSelectOption value="individual">{t`Individual`}</NativeSelectOption>
              <NativeSelectOption value="organization">{t`Organization`}</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {individual ? (
              <>
                {field("firstName", t`First name`)}
                {field("lastName", t`Last name`)}
              </>
            ) : (
              <div className="sm:col-span-2">{field("name", t`Name`)}</div>
            )}
            {field("contactEmail", t`Contact email`, { type: "email" })}
            {field("portfolioEmail", t`Portfolio email`, {
              type: "email",
              disabled: stakeholder?.portfolioEmailLocked,
            })}
            {individual && field("dateOfBirth", t`Date of birth`, { type: "date" })}
            {field("taxId", t`Tax ID`)}
            {field("employeeId", t`Employee ID`)}
          </div>
          {!editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stakeholder-relationship">{t`Relationship`}</Label>
                <NativeSelect
                  id="stakeholder-relationship"
                  value={form.relationship}
                  onChange={set("relationship")}
                >
                  <NativeSelectOption value="">{t`None`}</NativeSelectOption>
                  {EQUITY_RELATIONSHIPS.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {EQUITY_RELATIONSHIP_LABELS[value]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              {form.relationship && field("startDate", t`Start date`, { type: "date" })}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("country", t`Country`)}
            {field("street", t`Street`)}
            {field("city", t`City`)}
            {field("state", t`State/Province`)}
            {field("postalCode", t`Postal code`)}
          </div>
          {customProperties.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {customProperties.map((property) => (
                <div key={property.id} className="flex flex-col gap-1.5">
                  <Label htmlFor={`custom-${property.id}`}>{property.name}</Label>
                  <Input
                    id={`custom-${property.id}`}
                    value={form.custom[property.id] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        custom: { ...current.custom, [property.id]: event.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {editing ? t`Save` : t`Add stakeholder`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
