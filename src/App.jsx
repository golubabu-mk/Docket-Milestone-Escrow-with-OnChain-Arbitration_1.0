import { useState, useCallback, useEffect } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import CreateJobForm from './components/CreateJobForm'
import JobCard from './components/JobCard'
import JobCardSkeleton from './components/JobCardSkeleton'
import ActivityFeed from './components/ActivityFeed'
import Banner from './components/Banner'
import { useWallet } from './hooks/useWallet'
import { useEventStream } from './hooks/useEventStream'
import { isConfigured } from './lib/config'
import {
  createJob,
  submitMilestone,
  approveAndRelease,
  raiseDispute,
  settleDispute,
  getJob,
  normalizeJob,
} from './lib/escrowActions'

export default function App() {
  const wallet = useWallet()
  const { feed, isPolling } = useEventStream()

  const [jobs, setJobs] = useState({}) // { [jobId]: normalizedJob }
  const [txByJob, setTxByJob] = useState({})
  const [loadingJobs] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [knownJobIds, setKnownJobIds] = useState([])

  const configured = isConfigured()

  const refreshJob = useCallback(
    async (jobId) => {
      try {
        const raw = await getJob({ jobId })
        const normalized = normalizeJob(jobId, raw)
        setJobs((prev) => ({ ...prev, [jobId]: normalized }))
      } catch (err) {
        console.error(`Failed to load job ${jobId}:`, err)
      }
    },
    [wallet.address]
  )

  // Whenever a job-related event arrives in the live feed, re-fetch that
  // job's on-chain state so cards update without a manual page refresh.
  useEffect(() => {
    if (!configured || feed.length === 0) return
    const jobTopicIds = new Set()
    feed.forEach((entry) => {
      const rawTopics = entry.raw?.topics || []
      const numericTopic = rawTopics.find((t) => typeof t === 'number' || typeof t === 'bigint')
      if (numericTopic !== undefined) jobTopicIds.add(Number(numericTopic))
    })
    jobTopicIds.forEach((id) => {
      refreshJob(id)
      setKnownJobIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    })
    // Whenever any event occurs (like an approval), refresh the connected wallet's balance
    // so the freelancer sees their funds arrive in real-time.
    wallet.refreshBalance()
  }, [feed, configured, refreshJob, wallet])

  const handleCreate = async ({ freelancer, token, descriptions, amounts }) => {
    if (!wallet.address) {
      setErrorMsg('Connect your wallet before creating a job.')
      return
    }
    setErrorMsg(null)
    try {
      const { result: jobId, hash } = await createJob({
        client: wallet.address,
        freelancer,
        token,
        descriptions,
        amounts,
      })
      setTxByJob((prev) => ({ ...prev, [jobId]: hash }))
      setKnownJobIds((prev) => [...prev, Number(jobId)])
      await refreshJob(Number(jobId))
      await wallet.refreshBalance()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create job.')
    }
  }

  const withTxTracking = (jobId, fn) => async (...args) => {
    try {
      const { hash } = await fn(...args)
      setTxByJob((prev) => ({ ...prev, [jobId]: hash }))
      await refreshJob(jobId)
      await wallet.refreshBalance()
    } catch (err) {
      setErrorMsg(err.message || 'Transaction failed.')
    }
  }

  const handleSubmitMilestone = (jobId, milestoneIndex) =>
    withTxTracking(jobId, () =>
      submitMilestone({ freelancer: wallet.address, jobId, milestoneIndex })
    )()

  const handleApproveMilestone = (jobId, milestoneIndex) =>
    withTxTracking(jobId, () =>
      approveAndRelease({ client: wallet.address, jobId, milestoneIndex })
    )()

  const handleRaiseDispute = (jobId, reason) =>
    withTxTracking(jobId, () => raiseDispute({ caller: wallet.address, jobId, reason }))()

  const handleSettleDispute = (jobId) =>
    withTxTracking(jobId, () => settleDispute({ caller: wallet.address, jobId }))()

  const jobList = knownJobIds
    .map((id) => jobs[id])
    .filter(Boolean)
    .sort((a, b) => b.id - a.id)

  return (
    <div className="min-h-screen flex flex-col">
      <Header wallet={wallet} />
      <Hero />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 pb-16 flex-1">
        {!configured && (
          <div className="mb-6">
            <Banner type="warning">
              Contract addresses aren&apos;t configured yet. Set{' '}
              <code className="font-mono">VITE_ESCROW_CONTRACT_ID</code>,{' '}
              <code className="font-mono">VITE_ARBITER_CONTRACT_ID</code>, and{' '}
              <code className="font-mono">VITE_TOKEN_CONTRACT_ID</code> in your{' '}
              <code className="font-mono">.env</code> file after deploying — see
              DEPLOYMENT.md.
            </Banner>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6">
            <Banner type="error" onDismiss={() => setErrorMsg(null)}>
              {errorMsg}
            </Banner>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <section className="space-y-4 min-w-0">
            <CreateJobForm onCreate={handleCreate} disabled={!wallet.address || !configured} />

            {loadingJobs && (
              <>
                <JobCardSkeleton />
                <JobCardSkeleton />
              </>
            )}

            {!loadingJobs && jobList.length === 0 && (
              <p className="font-mono text-xs text-parchment-dim/40 text-center py-10">
                No jobs yet. The first docket opened here becomes Job #0000.
              </p>
            )}

            {jobList.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                walletAddress={wallet.address}
                onSubmitMilestone={handleSubmitMilestone}
                onApproveMilestone={handleApproveMilestone}
                onRaiseDispute={handleRaiseDispute}
                onSettleDispute={handleSettleDispute}
                lastTxHash={txByJob[job.id]}
              />
            ))}
          </section>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <ActivityFeed feed={feed} isPolling={isPolling} />
          </div>
        </div>
      </main>

      <footer className="border-t border-ink-line py-6 text-center">
        <p className="font-mono text-[11px] text-parchment-dim/30">
          Built on Soroban · Stellar Testnet
        </p>
      </footer>
    </div>
  )
}
