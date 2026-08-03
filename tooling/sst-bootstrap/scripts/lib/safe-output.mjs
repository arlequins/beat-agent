export function errorName(error) {
  return error instanceof Error && error.name ? error.name : "UnknownError";
}
