import { SHOW_CATEGORIES } from "@/lib/shows";
import { US_STATES } from "@/lib/states";

function value(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] : "";
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";

export function SubmissionEditForm({
  payload,
  action,
}: {
  payload: Record<string, unknown>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const selectedCategories = new Set(
    Array.isArray(payload.categories)
      ? payload.categories.filter((item): item is string => typeof item === "string")
      : []
  );

  return (
    <details className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        Edit submitted details
      </summary>
      <form action={action} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Show name" name="showName" defaultValue={value(payload, "showName")} required />
          <Field label="Venue name" name="venueName" defaultValue={value(payload, "venueName")} required />
          <Field label="Start date" name="startDate" type="date" defaultValue={value(payload, "startDate")} required />
          <Field label="End date" name="endDate" type="date" defaultValue={value(payload, "endDate")} required />
          <Field label="Start time" name="startTimeLabel" defaultValue={value(payload, "startTimeLabel")} />
          <Field label="End time" name="endTimeLabel" defaultValue={value(payload, "endTimeLabel")} />
          <Field label="City" name="city" defaultValue={value(payload, "city")} required />
          <label className="text-sm font-medium text-slate-700">
            State
            <select name="state" required defaultValue={value(payload, "state")} className={`${inputClass} mt-2`}>
              <option value="">Select a state</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>{state.name}</option>
              ))}
            </select>
          </label>
          <Field label="Venue address" name="venueAddress" defaultValue={value(payload, "venueAddress")} />
          <Field label="Table count" name="tableCount" type="number" defaultValue={value(payload, "tableCount")} />
          <Field label="Website" name="websiteUrl" type="url" defaultValue={value(payload, "websiteUrl")} />
          <Field label="Facebook" name="facebookUrl" type="url" defaultValue={value(payload, "facebookUrl")} />
          <Field label="Vendor details" name="vendorDetails" defaultValue={value(payload, "vendorDetails")} />
          <Field label="Parking info" name="parkingInfo" defaultValue={value(payload, "parkingInfo")} />
          <Field label="Admission price" name="admissionPrice" defaultValue={value(payload, "admissionPrice")} />
          <Field label="Admission notes" name="admissionNotes" defaultValue={value(payload, "admissionNotes")} />
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea name="description" rows={4} defaultValue={value(payload, "description")} className={`${inputClass} mt-2 resize-y`} />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Categories</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SHOW_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <input type="checkbox" name="categories" value={category} defaultChecked={selectedCategories.has(category)} />
                {category}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="isFree" value="free" defaultChecked={payload.isFree === true} /> Free
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="isFree" value="paid" defaultChecked={payload.isFree !== true} /> Paid / unspecified
          </label>
        </div>

        <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Save edits
        </button>
      </form>
    </details>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} className={`${inputClass} mt-2`} />
    </label>
  );
}
