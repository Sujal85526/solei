import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";
import { customerSearchFilter, parseCustomerSearch } from "./search";

describe("parseCustomerSearch", () => {
  it("ignores blank input", () => {
    expect(parseCustomerSearch("")).toBeNull();
    expect(parseCustomerSearch("   ")).toBeNull();
    expect(parseCustomerSearch(undefined)).toBeNull();
  });

  it.each([
    ["050 123 4567", "971501234567"],
    ["0501234567", "971501234567"],
    ["501234567", "971501234567"],
    ["+971 50 123 4567", "971501234567"],
    ["00971501234567", "971501234567"],
    ["(050) 123-4567", "971501234567"],
    ["+44 7700 900123", "447700900123"],
  ])("normalises the full number %s", (input, digits) => {
    expect(parseCustomerSearch(input)).toEqual({ kind: "phone", digits });
  });

  it("matches partial local numbers without the trunk zero", () => {
    expect(parseCustomerSearch("0501")).toEqual({ kind: "phone", digits: "501" });
    expect(parseCustomerSearch("4567")).toEqual({ kind: "phone", digits: "4567" });
    expect(parseCustomerSearch("+9715")).toEqual({ kind: "phone", digits: "9715" });
  });

  it("treats names and emails as text", () => {
    expect(parseCustomerSearch("Layla")).toEqual({ kind: "text", text: "Layla" });
    expect(parseCustomerSearch(" layla@example.com ")).toEqual({
      kind: "text",
      text: "layla@example.com",
    });
    expect(parseCustomerSearch("12")).toEqual({ kind: "text", text: "12" });
  });

  it("strips characters that would break the PostgREST filter", () => {
    expect(parseCustomerSearch('a,b(c)"d%e_f*g\\')).toEqual({
      kind: "text",
      text: "a b c d e f g",
    });
    expect(parseCustomerSearch(",,,")).toBeNull();
  });
});

describe("customerSearchFilter", () => {
  it("builds phone and text filters", () => {
    expect(customerSearchFilter({ kind: "phone", digits: "971501234567" })).toBe(
      "phone.ilike.%971501234567%",
    );
    expect(customerSearchFilter({ kind: "text", text: "lay" })).toBe(
      "name.ilike.%lay%,email.ilike.%lay%",
    );
  });
});

describe("csv", () => {
  it("quotes separators and quotes", () => {
    expect(csvCell('Al "Noor", Layla')).toBe('"Al ""Noor"", Layla"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(["email", "whatsapp"])).toBe("email whatsapp");
    expect(csvCell(1250)).toBe("1250");
  });

  it("neutralises spreadsheet formulas but keeps phone numbers and negatives", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell("+971501234567")).toBe("+971501234567");
    expect(csvCell("-12.50")).toBe("-12.50");
  });

  it("writes a BOM, header and CRLF rows", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a,b\r\n1,x\r\n");
  });
});
