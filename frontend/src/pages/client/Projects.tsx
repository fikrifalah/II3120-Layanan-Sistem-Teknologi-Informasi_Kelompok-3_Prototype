import { useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { useStore } from '../../services/store'
import { usePageTitle } from '../../lib/usePageTitle'
import type { ProjectStatus } from '../../types/domain'
import { LinkButton } from '../../components/ui/Button'
import { EmptyState, PageHeader, Tabs } from '../../components/ui/Display'
import { ProjectRow } from '../../components/ProjectRow'

type Tab = 'all' | 'talent' | 'contracting' | 'active' | 'completed'

const GROUPS: Record<Exclude<Tab, 'all'>, ProjectStatus[]> = {
  talent: ['draft', 'matching', 'inviting'],
  contracting: ['contracting', 'funding'],
  active: ['active'],
  completed: ['completed', 'cancelled'],
}

export default function Projects() {
  usePageTitle('My projects')
  const { projects } = useStore()
  const [tab, setTab] = useState<Tab>('all')
  const count = (t: Tab) => (t === 'all' ? projects.length : projects.filter((p) => GROUPS[t].includes(p.status)).length)
  const list = tab === 'all' ? projects : projects.filter((p) => GROUPS[tab].includes(p.status))

  return (
    <div>
      <PageHeader
        title="My projects"
        subtitle="Every project from first brief to closed contract."
        actions={
          <LinkButton to="/client/projects/new" icon={<Plus className="size-4" aria-hidden />}>
            Create Project
          </LinkButton>
        }
      />
      <Tabs<Tab>
        label="Project status"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'all', label: 'All', count: count('all') },
          { id: 'talent', label: 'Finding talent', count: count('talent') },
          { id: 'contracting', label: 'Contracting', count: count('contracting') },
          { id: 'active', label: 'Active', count: count('active') },
          { id: 'completed', label: 'Completed', count: count('completed') },
        ]}
      />
      <div key={tab} className="stagger space-y-3 pt-6">
        {list.length ? (
          list.map((p) => <ProjectRow key={p.id} project={p} />)
        ) : (
          <EmptyState icon={<FolderOpen className="size-6" />} title="Nothing here" body="No projects are at this stage right now." action={<LinkButton to="/client/projects/new">Create a project</LinkButton>} />
        )}
      </div>
    </div>
  )
}
