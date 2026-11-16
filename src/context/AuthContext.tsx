import {
      createContext,
        useContext,
          useEffect,
            useState,
              type ReactNode,
              } from 'react'
              import type { Session, User } from '@supabase/supabase-js'
              import { supabase } from '../lib/supabase'

              interface AuthContextType {
                user: User | null
                  session: Session | null
                    loading: boolean

                      signUp: (
                          email: string,
                              password: string,
                                  displayName: string
                                    ) => Promise<{ error: Error | null }>

                                      signIn: (
                                          email: string,
                                              password: string
                                                ) => Promise<{ error: Error | null }>

                                                  signOut: () => Promise<{ error: Error | null }>
                                                  }

                                                  const AuthContext = createContext<AuthContextType | undefined>(undefined)

                                                  export function AuthProvider({ children }: { children: ReactNode }) {
                                                    const [user, setUser] = useState<User | null>(null)
                                                      const [session, setSession] = useState<Session | null>(null)
                                                        const [loading, setLoading] = useState(true)

                                                          useEffect(() => {
                                                              async function loadSession() {
                                                                    const { data } = await supabase.auth.getSession()

                                                                          setSession(data.session)
                                                                                setUser(data.session?.user ?? null)
                                                                                      setLoading(false)
                                                                                          }

                                                                                              loadSession()

                                                                                                  const {
                                                                                                        data: { subscription },
                                                                                                            } = supabase.auth.onAuthStateChange((_event, currentSession) => {
                                                                                                                  setSession(currentSession)
                                                                                                                        setUser(currentSession?.user ?? null)
                                                                                                                            })

                                                                                                                                return () => {
                                                                                                                                      subscription.unsubscribe()
                                                                                                                                          }
                                                                                                                                            }, [])

                                                                                                                                              async function signUp(
                                                                                                                                                  email: string,
                                                                                                                                                      password: string,
                                                                                                                                                          displayName: string
                                                                                                                                                            ) {
                                                                                                                                                                const { error } = await supabase.auth.signUp({
                                                                                                                                                                      email,
                                                                                                                                                                            password,
                                                                                                                                                                                  options: {
                                                                                                                                                                                          data: {
                                                                                                                                                                                                    display_name: displayName,
                                                                                                                                                                                                            },
                                                                                                                                                                                                                  },
                                                                                                                                                                                                                      })

                                                                                                                                                                                                                          return {
                                                                                                                                                                                                                                error: error ? new Error(error.message) : null,
                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                      }

                                                                                                                                                                                                                                        async function signIn(email: string, password: string) {
                                                                                                                                                                                                                                            const { error } = await supabase.auth.signInWithPassword({
                                                                                                                                                                                                                                                  email,
                                                                                                                                                                                                                                                        password,
                                                                                                                                                                                                                                                            })

                                                                                                                                                                                                                                                                return {
                                                                                                                                                                                                                                                                      error: error ? new Error(error.message) : null,
                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                              async function signOut() {
                                                                                                                                                                                                                                                                                  const { error } = await supabase.auth.signOut()

                                                                                                                                                                                                                                                                                      return {
                                                                                                                                                                                                                                                                                            error: error ? new Error(error.message) : null,
                                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                                  }

                                                                                                                                                                                                                                                                                                    return (
                                                                                                                                                                                                                                                                                                        <AuthContext.Provider
                                                                                                                                                                                                                                                                                                              value={{
                                                                                                                                                                                                                                                                                                                      user,
                                                                                                                                                                                                                                                                                                                              session,
                                                                                                                                                                                                                                                                                                                                      loading,
                                                                                                                                                                                                                                                                                                                                              signUp,
                                                                                                                                                                                                                                                                                                                                                      signIn,
                                                                                                                                                                                                                                                                                                                                                              signOut,
                                                                                                                                                                                                                                                                                                                                                                    }}
                                                                                                                                                                                                                                                                                                                                                                        >
                                                                                                                                                                                                                                                                                                                                                                              {children}
                                                                                                                                                                                                                                                                                                                                                                                  </AuthContext.Provider>
                                                                                                                                                                                                                                                                                                                                                                                    )
                                                                                                                                                                                                                                                                                                                                                                                    }

                                                                                                                                                                                                                                                                                                                                                                                    export function useAuth() {
                                                                                                                                                                                                                                                                                                                                                                                      const context = useContext(AuthContext)

                                                                                                                                                                                                                                                                                                                                                                                        if (!context) {
                                                                                                                                                                                                                                                                                                                                                                                            throw new Error(
                                                                                                                                                                                                                                                                                                                                                                                                  'useAuth debe utilizarse dentro de AuthProvider'
                                                                                                                                                                                                                                                                                                                                                                                                      )
                                                                                                                                                                                                                                                                                                                                                                                                        }

                                                                                                                                                                                                                                                                                                                                                                                                          return context
                                                                                                                                                                                                                                                                                                                                                                                                          }