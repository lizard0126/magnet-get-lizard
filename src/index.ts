import { Context, Schema } from 'koishi'
import { } from 'koishi-plugin-puppeteer'

export const name = 'magnet-get-lizard'
export const inject = ['puppeteer'];

export const usage = `
# ⚠️ NSFW警告!!!
## 通过关键词搜索磁力链接资源。

## 配置多个资源站点，若搜索失败可更换站点。

## 请低调使用，请勿配置于 QQ 或其他国内 APP 平台，带来的后果请自行承担。

---

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">使用方法</span></strong></summary>

### 关键词搜索磁力链接
#### 示例：
<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">magnet sone111 // 搜索关键词sone111的资源</pre>

### 支持配置：
- **搜索站点**：如搜索失败可在配置中切换使用的资源站。
- **返回数量**：可设置每次最多返回几条搜索结果（默认 3 条，最多 10 条）。
- **是否显示影片信息**：如发布日期、影片信息、演员等，启用后会一并显示。
  - 影片信息不全面，可以和我的另一个插件[javbus-lizard](https://github.com/lizard0126/javbus-lizard)结合使用。

### 关键词：
- 无需严格输入番号，支持模糊搜索。
- 支持中文搜索，如“某某探花”等。

</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">反馈建议或报告问题</span></strong></summary>

<strong>可以[点这里](https://github.com/lizard0126/magnet-get-lizard/issues)创建议题~</strong>

</details>

<details>
<summary><strong><span style="font-size: 1.3em; color: #2a2a2a;">如果喜欢我的插件</span></strong></summary>

<strong>可以[请我喝可乐](https://ifdian.net/a/lizard0126)，没准就有动力更新新功能了~</strong>

</details>
`

export interface Config {
  site: string
  maxResults?: number
  ifMessage: boolean
}

const sites = [
  'https://18mag.net',
  'https://xcili.com',
  'https://1cili.com',
  'https://cili.info',
  'https://cili.uk',
  'https://wuji.me',
]

export const Config: Schema<Config> = Schema.object({
  site: Schema.union(sites.map(site => Schema.const(site)))
    .default('https://18mag.net')
    .description('如果一直搜索失败，可以更换站点再试'),
  maxResults: Schema.number()
    .min(1)
    .max(10)
    .default(3)
    .description('搜索结果展示数量'),
  ifMessage: Schema.boolean()
    .default(false)
    .description('是否展示影片信息（发布日期、影片信息、演员，不一定都有）'),
})

export function apply(ctx: Context, config) {
  ctx.command('magnet <keyword>', '关键词搜索磁链资源')
    .action(async ({ session }, keyword) => {
      if (!keyword) return '未输入关键词！'

      try {
        const searchUrl = `${config.site}/search?q=${encodeURIComponent(keyword)}`
        const page = await ctx.puppeteer.page()

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' })

        let links = await page.$$eval('.file-list tr a', (elements, max, site) => {
          return elements.map(el => (el as HTMLAnchorElement).getAttribute('href'))
            .filter(href => href)
            .map(href => site + href)
            .slice(0, max)
        }, config.maxResults, config.site)

        if (links.length === 0) {
          await page.close()
          return '没有找到相关信息，请更换关键词重试'
        }

        let result = ''

        for (const link of links) {
          await page.goto(link, { waitUntil: 'domcontentloaded' })

          const detail = await page.evaluate((ifMessage) => {
            const title = document.querySelector('.magnet-title')?.textContent?.trim()

            const dtElements = Array.from(document.querySelectorAll('.torrent-info dt'))
            const info = dtElements.map(dt => {
              let key = dt.textContent?.trim().replace(/[:：\s]/g, '')
              let dd = dt.nextElementSibling?.textContent?.trim()

              if (key === '种子特征码') {
                key = '磁链'
                dd = `magnet:?xt=urn:btih:${dd}`
              }

              if (!ifMessage) {
                if (key === '发布日期') return ''
                else if (key === '影片信息') return ''
                else if (key === '演员') return ''
              }

              if (key === '推荐网盘') return ''

              return key && dd ? `${key} ：${dd}` : ''
            }).filter(Boolean).join('\n')

            return { title, info }
          }, config.ifMessage)

          result += `标题：${detail.title}\n${detail.info}\n\n`
        }

        await page.close()

        return result
      } catch (err) {
        console.error(err)
        return '获取失败，请稍后重试。'
      }
    })
}
