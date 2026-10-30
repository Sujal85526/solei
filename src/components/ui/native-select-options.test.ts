import { createElement as h, Fragment } from "react";
import { describe, expect, it } from "vitest";
import { optionsFromChildren } from "./native-select-options";

describe("optionsFromChildren", () => {
  it("reads values, joined labels and disabled options", () => {
    const options = optionsFromChildren([
      h("option", { key: 1, value: "" }, "Any"),
      h("option", { key: 2, value: "a" }, "● ", "Event", " (closed)"),
      h("option", { key: 3, value: 5, disabled: true }, "Five"),
    ]);
    expect(options).toEqual([
      { value: "", label: "Any", disabled: false, group: undefined },
      { value: "a", label: "● Event (closed)", disabled: false, group: undefined },
      { value: "5", label: "Five", disabled: true, group: undefined },
    ]);
  });

  it("falls back to the label when an option has no value", () => {
    expect(optionsFromChildren(h("option", null, "Plain"))[0].value).toBe("Plain");
  });

  it("goes through fragments, arrays and optgroups, and skips the rest", () => {
    const options = optionsFromChildren([
      null,
      false,
      h(
        Fragment,
        { key: "f" },
        h("option", { value: "x" }, "X"),
        h("optgroup", { label: "Perfumes" }, [h("option", { key: "y", value: "y" }, "Y")]),
      ),
    ]);
    expect(options.map((o) => [o.value, o.group])).toEqual([
      ["x", undefined],
      ["y", "Perfumes"],
    ]);
  });
});
