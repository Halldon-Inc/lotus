import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        // For development, use hardcoded users
        // In production, this would check against the database
        const users = [
          {
            id: '1',
            email: 'admin@lotus.com',
            name: 'Admin User',
            role: 'ADMIN' as const,
            password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewGKrKrLXOJqZl.6' // password123
          },
          {
            id: '2',
            email: 'manager@lotus.com',
            name: 'Manager User',
            role: 'MANAGER' as const,
            password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewGKrKrLXOJqZl.6' // password123
          },
          {
            id: '3',
            email: 'sales@lotus.com',
            name: 'Sales Rep',
            role: 'SALES' as const,
            password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewGKrKrLXOJqZl.6' // password123
          },
          {
            id: '4',
            email: 'procurement@lotus.com',
            name: 'Procurement User',
            role: 'PROCUREMENT' as const,
            password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewGKrKrLXOJqZl.6' // password123
          }
        ]

        const user = users.find(u => u.email === credentials.email)
        
        if (!user) {
          throw new Error('No user found with this email')
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isPasswordValid) {
          throw new Error('Invalid password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
