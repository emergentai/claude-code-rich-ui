// State values of the rich-ui plugin (contract: types/index.d.ts):
//
//   enabled     explicit on/off choices, by feature id        shape 'enabled-1'
//   status      per-feature errors and notes                  shape 'status-1'
//   saveFailed  whether the last save of `enabled` failed     shape 'save-failed-1'
//   shown       diagrams currently showing their source       shape 'shown-1'
//
// There is nothing to import from here. The engine's module scan reads a state
// source (`atom(...)` or a literal reference) only where it is written, in the
// same file as the `read`/`update` call, so each file that touches a value
// declares its own atom with the shape tag above.
export {}
