// 初始化模式 + 组队流程的状态承载（跨 Setup → Analyzing → Proposal / Join → Claim）
import { defineStore } from 'pinia'
import { api } from '../api'

export const useInitStore = defineStore('init', {
  state: () => ({
    // 初始化（创立人）
    projectId: null,
    projectName: '',
    projectDesc: '',
    members: [], // [{name, role_description, me?}]
    draft: null, // {tasks, unassigned_gaps, invite_code}
    analyzing: false,
    analyzeError: null,
    // 组队（组员）
    joinData: null, // {project, roles}
    inviteCode: '',
  }),

  actions: {
    // Setup 提交后：建项目 → 一次性 LLM 生成任务草案（Analyzing 页等待此 promise）
    async initialize({ name, description, members }) {
      this.analyzing = true
      this.analyzeError = null
      this.projectName = name
      this.projectDesc = description
      this.members = members
      try {
        const project = await api('POST', '/api/v1/projects', { name, description })
        this.projectId = project.id
        this.draft = await api('POST', `/api/v1/projects/${project.id}/initialize`, { members })
        this.analyzing = false
        return true
      } catch (e) {
        this.analyzing = false
        this.analyzeError = e.message
        return false
      }
    },

    // 刷新后恢复草案（直接进 /proposal 时）
    async loadDraft(pid) {
      this.projectId = pid
      const data = await api('GET', `/api/v1/projects/${pid}/initialize/draft`)
      const project = await api('GET', `/api/v1/projects/${pid}`)
      this.projectName = project.name
      this.projectDesc = project.description
      this.members = project.roles.filter((r) => !r.is_archived).map((r) => ({
        name: r.member_name || r.name,
        role_description: r.description || '',
        role_id: r.id,
      }))
      this.draft = { tasks: data.items, unassigned_gaps: [], invite_code: data.invite_code }
    },

    // 创立人确认调整后的草案 → 项目进入运行模式
    async confirm(tasks) {
      await api('POST', `/api/v1/projects/${this.projectId}/initialize/confirm`, { tasks })
    },

    // 组员：邀请码查询项目与角色
    async join(code) {
      this.inviteCode = code.trim().toUpperCase()
      this.joinData = await api('POST', '/api/v1/projects/join', { invite_code: this.inviteCode })
      this.projectId = this.joinData.project.id
    },

    // 组员：认领角色
    async claimRole(roleId) {
      await api('POST', `/api/v1/projects/${this.projectId}/claim-role`, {
        invite_code: this.inviteCode,
        role_id: roleId,
      })
    },
  },
})
