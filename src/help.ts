export const help = `LinguaFlow CLI

Usage: linguaflow <command> [options]

  --version                    Print the installed CLI version

Delivery commands:
  pull                         Download schema and build-time locale bundles
  generate                     Generate configured Dart/TypeScript/Swift/Kotlin keys
  sync                         Run pull followed by generate
  check                        Validate local files and ICU contracts

Management commands (LINGUAFLOW_MANAGEMENT_KEY required):
  push [--file PATH --locale tr] [--format nested_json]
  diff                         Compare local files with the branch draft
  branch list
  branch create --name NAME [--from BRANCH_ID]
  branch overwrite --from BRANCH_ID [--target BRANCH_ID]
  publish --message TEXT [--strategy reject] [--idempotency-key KEY]

Global option:
  --config PATH                Config file (default: .linguaconfig)
`
