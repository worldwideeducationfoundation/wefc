"use client";

import { useActionState } from "react";
import { type ContactState, submitContact } from "@/app/(site)/contact/actions";
import { Info, Send } from "./Icons";

export type ContactFormCopy = {
  title: string;
  text: string;
  optinTitle: string;
  optinText: string;
  button: string;
  success: string;
  direct: string;
};

/** The contact form. Messages are stored in Admin -> Messages. */
export function ContactForm({ copy, topics, email }: { copy: ContactFormCopy; topics: string[]; email: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });
  const v = state.status === "sent" ? {} : (state.values ?? {});
  const err = state.errors ?? {};
  const message = state.status === "sent" ? copy.success : state.status === "error" ? state.message : "";

  return (
    <div className="ct-form-wrap">
      <h2>{copy.title}</h2>
      <p className="sub">{copy.text}</p>
      {/* Remounted after a successful send so the fields clear. */}
      <form key={state.status === "sent" ? "sent" : "form"} className="ct-form" action={action} noValidate>
        <div className="ct-row">
          <div className="ct-field">
            <label htmlFor="ctName">
              Name <span className="req">*</span>
            </label>
            <input type="text" id="ctName" name="name" placeholder="Your full name" required defaultValue={v.name} aria-invalid={!!err.name} />
          </div>
          <div className="ct-field">
            <label htmlFor="ctPhone">Phone</label>
            <input type="tel" id="ctPhone" name="phone" placeholder="Optional" defaultValue={v.phone} />
          </div>
        </div>
        <div className="ct-field">
          <label htmlFor="ctEmail">
            Email <span className="req">*</span>
          </label>
          <input type="email" id="ctEmail" name="email" placeholder="you@example.com" required defaultValue={v.email} aria-invalid={!!err.email} />
        </div>
        <div className="ct-field">
          <label htmlFor="ctTopic">What&apos;s this about?</label>
          <select id="ctTopic" name="topic" defaultValue={v.topic}>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="ct-field">
          <label htmlFor="ctMessage">
            Message <span className="req">*</span>
          </label>
          <textarea id="ctMessage" name="message" placeholder="How can we help?" required defaultValue={v.message} aria-invalid={!!err.message} />
        </div>
        <label className="ct-optin" htmlFor="ctSubscribe">
          <input type="checkbox" id="ctSubscribe" name="subscribe" defaultChecked={!!v.subscribe} />
          <span>
            <strong>{copy.optinTitle}</strong>
            {copy.optinText}
          </span>
        </label>
        <div className="wef-hp" aria-hidden="true">
          <label>
            Leave this field empty
            <input type="text" name="wef_hp" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button className="ct-submit" type="submit" disabled={pending}>
          {pending ? "Sending…" : copy.button}
          <Send />
        </button>
        <div className={`ct-msg${message ? " show" : ""}${state.status === "error" ? " is-error" : ""}`} role="status">
          {message && <Info />}
          <span>
            {message}
            {Object.values(err).length > 0 && " " + Object.values(err).join(" ")}
          </span>
        </div>
        <p className="ct-note">
          {copy.direct} <a href={`mailto:${email}`}>{email}</a>.
        </p>
      </form>
    </div>
  );
}
