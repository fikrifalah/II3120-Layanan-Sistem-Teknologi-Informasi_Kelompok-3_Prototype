import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import PageTop from '../../components/layout/PageTop.jsx'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import { useI18n } from '../../i18n/index.jsx'
import usePageTitle from '../../lib/usePageTitle.js'
import { paths } from '../routes.js'

/** Placeholder for client screens that are designed but not built yet. */
export default function ComingSoon({ nameKey }) {
  const { t } = useI18n()
  const name = t(nameKey)
  usePageTitle(name)
  return (
    <>
      <PageTop crumb={name} />
      <Card className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary-subtle text-primary">
          <Hammer className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-h3">{t('app.comingSoon.title')}</h1>
        <p className="text-body text-ink-muted">{t('app.comingSoon.body', { name })}</p>
        <div className="pt-2">
          <Button as={Link} to={paths.dashboard} variant="secondary">
            {t('app.comingSoon.back')}
          </Button>
        </div>
      </Card>
    </>
  )
}
