"use client";

import { useActionState } from "react";
import { type NewsletterState, subscribeNewsletter } from "@/app/(site)/newsletter/actions";
import { ArrowRight } from "./Icons";

export type NewsletterCopy = { eyebrow: string; title: string; text: string; button: string; note: string; success: string };

/** The newsletter band on the home page. Addresses land in Admin -> Newsletter. */
export function NewsletterForm({ copy }: { copy: NewsletterCopy }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeNewsletter, { status: "idle" });
  const message = state.status === "done" ? copy.success : state.status === "error" ? state.message : "";

  return (
    <section className="section wef-news" id="newsletter">
      <div className="container wef-news-inner">
        <div className="wef-news-copy reveal">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.text}</p>
        </div>
        <form className="wef-news-form reveal" action={action} noValidate>
          <div className="wef-news-fields">
            <label className="wef-field">
              <span>Name</span>
              <input type="text" name="name" autoComplete="name" placeholder="Optional" defaultValue={state.values?.name} />
            </label>
            <label className="wef-field">
              <span>
                Email <span className="req">*</span>
              </span>
              <input type="email" name="email" autoComplete="email" placeholder="you@example.com" required defaultValue={state.values?.email} />
            </label>
          </div>
          <div className="wef-hp" aria-hidden="true">
            <label>
              Leave this field empty
              <input type="text" name="wef_hp" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <button className="btn wef-news-submit" type="submit" disabled={pending}>
            {pending ? "Subscribing…" : copy.button}
            <ArrowRight />
          </button>
          <p
            className={`wef-form-status${message ? ` show is-${state.status === "done" ? "success" : "error"}` : ""}`}
            role="status"
          >
            <span>{message}</span>
          </p>
          <p className="wef-news-note">{copy.note}</p>
        </form>
      </div>
    </section>
  );
}
