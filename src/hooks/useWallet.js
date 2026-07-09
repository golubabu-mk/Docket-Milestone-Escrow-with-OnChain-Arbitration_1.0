import { useState, useCallback, useEffect } from 'react'
import { connectWallet, isFreighterInstalled } from '../lib/wallet'
import { getNativeBalance } from '../lib/escrowActions'

export function useWallet() {
  const [address, setAddress] = useState(null)
  const [balance, setBalance] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [installed, setInstalled] = useState(true)

  useEffect(() => {
    isFreighterInstalled().then(setInstalled)
  }, [])

  const refreshBalance = useCallback(async (addr) => {
    const targetAddr = addr || address
    if (!targetAddr) return
    try {
      const bal = await getNativeBalance(targetAddr)
      if (bal !== null) {
        // SCV_I128 is returned as BigInt by scValToNative, convert to string
        setBalance(bal.toString())
      }
    } catch (err) {
      console.error('Failed to fetch balance', err)
    }
  }, [address])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const addr = await connectWallet()
      setAddress(addr)
      await refreshBalance(addr)
    } catch (err) {
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }, [refreshBalance])

  const disconnect = useCallback(() => {
    setAddress(null)
    setBalance(null)
  }, [])

  return { address, balance, connecting, error, installed, connect, disconnect, refreshBalance }
}
