import { z } from "zod";

const uuid = z.uuid();

/** True for a well-formed UUID: lets detail pages answer "not found" instead of a query error. */
export const isUuid = (v: string) => uuid.safeParse(v).success;
