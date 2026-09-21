#!/usr/bin/env python3
"""
Turn the normalized vendor price lists into Volusion "Vendor Rules" import files.

    python3 scripts/price-lists/volusion-vendor-rules.py

Inputs
  price-lists/volusion/exports/Vendors.csv       Volusion → Import/Export → Vendors
  price-lists/volusion/exports/VendorRules.csv   Volusion → Import/Export → Vendor_Rules
  price-lists/normalized/<vendor>.csv            from normalize.py

Outputs (price-lists/volusion/out/)
  VendorRules-updated.csv         the full Vendor_Rules table with vr_price refreshed wherever a
                                  rule's part matched a new price list (same vr_id → safe re-import)
  VendorRules-new-candidates.csv  parts we now have a cost for but that have NO rule yet. vr_id is
                                  blank; vr_productcode is set to the vendor part number. Volusion
                                  only honors a rule whose productcode exists in the store, so review
                                  / map these before importing.
  Vendors-new.csv                 vendor rows for price-list vendors that aren't in Volusion yet
                                  (placeholder ids — Volusion assigns the real one on create)
  report.md                       what changed, biggest movers, unmatched rules

A rule matches a price-list row when its vr_partno OR vr_productcode equals the row's
Part Number, or (NABCO) the row's Old Part #. Matching ignores case, whitespace and a
trailing '-'.
"""
import csv
import json
import os
import re
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
NORM = os.path.join(ROOT, "price-lists", "normalized")
VOL = os.path.join(ROOT, "price-lists", "volusion")
OUT = os.path.join(VOL, "out")

# PartFinder distributor id → Volusion vendor_title (as exported). Vendors not listed here get a
# placeholder row in Vendors-new.csv.
VENDOR_TITLES = {
    "bea": "BEA Inc.",
    "nabco-gyrotech": "Nabco Entrances Inc.",
    "motion-access": "MOTION ACCESS, LLC",
    "ms-sedco": "MS SEDCO",
    "xcluder": "Xcluder (Global Material Technologies)",
    "horton": "Horton Automatics (via Advanced Door Services)",
    "record-usa": "Record USA",
    "ready-access": "Ready Access",
    "optex": "OPTEX Technologies",
    "quad-systems": "Quad Systems LLC",
}


def norm(s):
    return re.sub(r"\s+", "", str(s or "")).upper().rstrip("-")


def read_csv(path):
    with open(path, encoding="utf-8-sig", errors="ignore", newline="") as f:
        r = csv.DictReader(f)
        return list(r), r.fieldnames


def fmt_price(v):
    return f"{float(v):.4f}"


def main():
    os.makedirs(OUT, exist_ok=True)
    vendors, vendor_cols = read_csv(os.path.join(VOL, "exports", "Vendors.csv"))
    rules, rule_cols = read_csv(os.path.join(VOL, "exports", "VendorRules.csv"))
    manifest = json.load(open(os.path.join(NORM, "manifest.json")))

    by_title = {v["vendor_title"].strip().upper(): v for v in vendors}
    # Some Volusion titles differ slightly from ours — resolve by first word too (BEA, NABCO, MS SEDCO…).
    def find_vendor(title):
        u = title.upper()
        if u in by_title:
            return by_title[u]
        head = re.split(r"[\s,]", u)[0]
        for t, v in by_title.items():
            if t.startswith(head):
                return v
        return None

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    stamp = datetime.now().strftime("%Y-%m-%d")
    report = [f"# Volusion vendor-rule refresh — {stamp}", ""]
    updated_rules = [dict(r) for r in rules]
    new_candidates, new_vendors = [], []
    next_placeholder = 900
    total_changed = 0

    for vid, meta in manifest["vendors"].items():
        if meta.get("error"):
            continue
        rows, _ = read_csv(os.path.join(ROOT, meta["file"]))
        priced = {norm(r["Part Number"]): r for r in rows if r.get("Net Price")}
        alt = {}  # NABCO old part numbers etc.
        for r in rows:
            if r.get("Net Price") and r.get("Old Part #"):
                alt[norm(r["Old Part #"])] = r
        title = VENDOR_TITLES.get(vid, vid)
        vendor = find_vendor(title)
        if not vendor:
            next_placeholder += 1
            vendor = {c: "" for c in vendor_cols}
            vendor.update({"vendor_id": str(next_placeholder), "vendor_title": title, "active": "Y",
                           "vendor_po_sendvia": "", "lastmodified": now, "lastmodby": "1", "allows_dropshipping": "N"})
            new_vendors.append(vendor)
        vendor_id = vendor["vendor_id"]

        mine = [r for r in updated_rules if r["vendor_id"] == vendor_id]
        matched_parts, changes, unmatched = set(), [], []
        for rule in mine:
            hit = priced.get(norm(rule["vr_partno"])) or priced.get(norm(rule["vr_productcode"])) \
                or alt.get(norm(rule["vr_partno"])) or alt.get(norm(rule["vr_productcode"]))
            if not hit:
                unmatched.append(rule["vr_partno"] or rule["vr_productcode"])
                continue
            matched_parts.add(norm(hit["Part Number"]))
            old_p, new_p = float(rule["vr_price"] or 0), float(hit["Net Price"])
            if abs(old_p - new_p) >= 0.005:
                changes.append((rule["vr_partno"] or rule["vr_productcode"], old_p, new_p, hit["Description"][:50]))
                rule["vr_price"] = fmt_price(new_p)
                rule["lastmodified"] = now
        for key, r in priced.items():
            if key in matched_parts:
                continue
            new_candidates.append({c: "" for c in rule_cols} | {
                "vr_id": "", "vendor_id": vendor_id, "vr_productcode": r["Part Number"], "vr_minqty": "1",
                "vr_maxqty": "", "vr_price": fmt_price(r["Net Price"]), "vr_partno": r["Part Number"],
                "vr_deactivate_until": "", "lastmodified": now, "lastmodby": "1",
                "_description": r["Description"][:80], "_list_price": r.get("List Price") or "",
            })
        total_changed += len(changes)
        movers = sorted(changes, key=lambda c: abs(c[2] - c[1]) / (c[1] or 1), reverse=True)[:8]
        report += [f"## {title}  (Volusion vendor_id {vendor_id}{' — NEW, placeholder id' if vendor in new_vendors else ''})",
                   f"- price list: `{meta['source']}` · effective {meta.get('effective', '?')} · cost basis: {meta.get('cost_basis', '?')}",
                   f"- existing rules: {len(mine)} · matched: {len(mine) - len(unmatched)} · price changed: {len(changes)} · unmatched: {len(unmatched)}",
                   f"- parts with a cost but no rule yet: {len(priced) - len(matched_parts)}"]
        if movers:
            report.append("- biggest movers:")
            report += [f"    - `{p}` ${o:,.2f} → ${n:,.2f}  ({d})" for p, o, n, d in movers]
        if unmatched:
            report.append(f"- rules not on this year's list (left as-is): {', '.join(unmatched[:15])}{' …' if len(unmatched) > 15 else ''}")
        report.append("")

    with open(os.path.join(OUT, "VendorRules-updated.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rule_cols, quoting=csv.QUOTE_ALL)
        w.writeheader(); w.writerows(updated_rules)
    with open(os.path.join(OUT, "VendorRules-new-candidates.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rule_cols + ["_description", "_list_price"], quoting=csv.QUOTE_ALL)
        w.writeheader(); w.writerows(new_candidates)
    with open(os.path.join(OUT, "Vendors-new.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=vendor_cols, quoting=csv.QUOTE_ALL)
        w.writeheader(); w.writerows(new_vendors)
    report.insert(2, f"**{total_changed} rule prices updated**, {len(new_candidates)} new-rule candidates, {len(new_vendors)} vendors to create. "
                     "Import `VendorRules-updated.csv` as-is (it keeps every vr_id). Review the candidates file — drop the two `_` "
                     "helper columns and keep only product codes that exist in the store — before importing it.\n")
    open(os.path.join(OUT, "report.md"), "w").write("\n".join(report))
    print("\n".join(report))


if __name__ == "__main__":
    main()
