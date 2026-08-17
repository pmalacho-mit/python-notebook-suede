import { marked } from "marked";

/** Headings written without a space after the hashes are common in the wild. */
const spaced = (text: string) => text.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");

export const asHtml = (source: string) => marked(spaced(source));
