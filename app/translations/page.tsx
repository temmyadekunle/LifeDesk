import { en } from "@/lib/locales/en";
import { ha } from "@/lib/locales/ha";
import { ig } from "@/lib/locales/ig";
import { yo } from "@/lib/locales/yo";
import "./translations.css";

const DICTIONARIES = [
  { code: "ha", name: "Hausa", dict: ha },
  { code: "yo", name: "Yorùbá", dict: yo },
  { code: "ig", name: "Igbo", dict: ig },
] as const;

/** Placeholders like {name} and {n} tell a reviewer what gets substituted. */
const placeholders = (value: string) =>
  Array.from(value.matchAll(/\{(\w+)\}/g), (m) => m[1]);

const prefix = (key: string) => key.split(".")[0] ?? "other";

export default function TranslationsPage() {
  const keys = Object.keys(en) as (keyof typeof en)[];

  const groups = keys.reduce<Record<string, (keyof typeof en)[]>>((acc, key) => {
    const p = prefix(key);
    (acc[p] ??= []).push(key);
    return acc;
  }, {});

  const flagged = keys.filter((key) =>
    DICTIONARIES.some(
      ({ dict }) => placeholders(en[key]).join(",") !== placeholders(dict[key]).join(","),
    ),
  );

  return (
    <div className="proof">
      <header className="proof-head">
        <h1>Livanta translation proof</h1>
        <p className="proof-lede">
          Every user-facing string in Livanta across all four languages. Please
          read the Hausa, Yorùbá and Igbò columns and flag anything that sounds
          unnatural, uses the wrong register, or is not how you would say it.
        </p>
        <ul className="proof-facts">
          <li>
            <strong>{keys.length}</strong> strings
          </li>
          <li>
            <strong>4</strong> languages
          </li>
          <li>
            <strong>{Object.keys(groups).length}</strong> groups
          </li>
          <li className={flagged.length ? "bad" : "good"}>
            <strong>{flagged.length}</strong> placeholder mismatches
          </li>
        </ul>
        {flagged.length > 0 && (
          <p className="proof-warn">
            Placeholder mismatches (these break at runtime):{" "}
            {flagged.map((k) => (
              <code key={k}>{k}</code>
            ))}
          </p>
        )}
      </header>

      {Object.entries(groups).map(([group, groupKeys]) => (
        <section className="proof-group" key={group}>
          <h2>{group}</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">English</th>
                {DICTIONARIES.map(({ name }) => (
                  <th scope="col" key={name}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupKeys.map((key) => {
                const vars = placeholders(en[key]);
                const mismatched = DICTIONARIES.some(
                  ({ dict }) =>
                    placeholders(dict[key]).join(",") !== vars.join(","),
                );
                return (
                  <tr key={key} className={mismatched ? "row-bad" : undefined}>
                    <th scope="row">
                      <code>{key}</code>
                      {vars.length > 0 && (
                        <span className="ph">{vars.map((v) => `{${v}}`).join(" ")}</span>
                      )}
                    </th>
                    <td lang="en">{en[key]}</td>
                    {DICTIONARIES.map(({ code, dict }) => (
                      <td key={code} lang={code}>
                        {dict[key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}