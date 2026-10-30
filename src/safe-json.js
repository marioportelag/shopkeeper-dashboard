const UNSAFE_CHARACTERS = /[<>&\u2028\u2029]/g;

/**
 * Serializes a value as JSON that is safe to place inside an HTML
 * `<script type="application/json">` element.
 *
 * `JSON.stringify` alone leaves `<`, `>` and `&` intact, so a value such as
 * `</script><script>…` would terminate the element and inject markup. Escaping
 * them (and the U+2028/U+2029 line separators) as \uXXXX sequences keeps the
 * output valid JSON that parses back to the exact original value.
 */
export function serializeForScript(value) {
  return JSON.stringify(value).replace(
    UNSAFE_CHARACTERS,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
