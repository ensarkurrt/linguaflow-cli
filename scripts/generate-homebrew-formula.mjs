import fs from 'node:fs'
import path from 'node:path'

const version = process.argv[2]
const sha256 = process.argv[3]
const output = process.argv[4] ?? 'dist/homebrew/linguaflow.rb'
if (!version || !sha256)
  throw new Error('Kullanım: generate-homebrew-formula.mjs <version> <sha256> [output]')

const formula = `class Linguaflow < Formula
  desc "LinguaFlow localization CLI"
  homepage "https://github.com/ensarkurrt/linguaflow-cli"
  url "https://registry.npmjs.org/@linguaflow/cli/-/cli-${version}.tgz"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node@24"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/linguaflow"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/linguaflow --version")
  end
end
`

const outputPath = path.resolve(import.meta.dirname, '..', output)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, formula)
