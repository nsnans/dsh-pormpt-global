/**
 * dsh-pormpt-global — 用户层提示词注入（host 半）。
 *
 * 把设置页维护的全局提示词，作为系统提示词的一个用户层 section 注入。
 * section 之后、关掉宿主严格插值、文本用活函数现读配置。
 */

import z from '@deepseek-ai/schemastery'

// 设置页命名空间，与 client 卡片共用
export const PORMPT_GLOBAL_NAMESPACE = 'pormpt-global'

// 注入用的 section 名，命名空间前缀避免与宿主撞名
export const SECTION_NAME = 'pormpt-global:custom-prompt'

// section 排序，取 1000000 排在所有内置 section 之后
export const SECTION_ORDER = 1000000

// 是否按字面注入，置 false 关掉宿主严格插值不抛错
export const SECTION_INTERPOLATE = false

const PromptSchema = z.object({
  id: z.string().default(''),
  title: z.string().default(''),
  text: z.string().default(''),
  enabled: z.boolean().default(true)
})

// 可编辑配置：总开关 + 提示词列表
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  prompts: z.array(PromptSchema).default([]).volatile()
})

// 宿主服务依赖
export const inject = ['systemPrompt']

// 读配置字段，volatile 字段是 {get()} 活引用，普通字段是裸值
function readField(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function' && !Array.isArray(value)) {
    return value.get()
  }
  return value
}

// 把配置拼成注入文本，总开关开着就拼所有启用且正文非空的提示词
export function renderPrompts(config) {
  if (readField(config && config.enabled) === false) return ''
  const list = readField(config && config.prompts)
  if (!Array.isArray(list)) return ''
  const parts = []
  for (const prompt of list) {
    if (!prompt || prompt.enabled === false) continue
    const text = typeof prompt.text === 'string' ? prompt.text : ''
    if (text.trim().length === 0) continue
    parts.push(text)
  }
  return parts.join('\n\n')
}

// 构造注入的 section，text 是活函数每次组装现读配置
export function promptSection(render) {
  return {
    name: SECTION_NAME,
    order: SECTION_ORDER,
    interpolate: SECTION_INTERPOLATE,
    text: () => {
      try {
        const text = render()
        return typeof text === 'string' ? text : ''
      } catch {
        return ''
      }
    }
  }
}

export function apply(ctx, config = {}) {
  // 关掉宿主自动生成的默认设置页，设置卡由 client 注册进插件页
  ctx.inject(['settings'], (sctx) => {
    sctx.effect(() => sctx.settings.configure({ auto: false }, ctx.fiber))
  })

  // 注册注入 section，未配置时是空文本，渲染时被丢弃
  ctx.effect(
    () => ctx.systemPrompt.section(promptSection(() => renderPrompts(config))),
    'pormpt-global: section()'
  )
}
