# @linguaflow/cli

LinguaFlow çevirilerini indirir, ICU sözleşmelerini doğrular, type-safe kaynak kod üretir ve
Management API işlemlerini CI/CD içinde çalıştırır.

```bash
npm install --global @linguaflow/cli
linguaflow sync
linguaflow check
```

Projeye development dependency olarak kurulursa `pnpm exec linguaflow sync`; kurulum yapılmadan tek
çalıştırma için `pnpm dlx @linguaflow/cli sync` kullanılabilir.

CLI proje kökündeki `.linguaconfig` dosyasını okur. API origin ve management secret bilinçli olarak
bu dosyaya yazılmaz. Management komutları `LINGUAFLOW_MANAGEMENT_KEY` environment değişkenini ister.
Ayrıntılı kullanım ve Homebrew yayınlama süreci için
[CLI dokümanına](../../docs/25-cli-and-ci.md) bakın.
