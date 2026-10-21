import {integer,sqliteTable,text,index} from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),branch:text('branch').notNull(),expires:integer('expires').notNull(),created:integer('created').notNull()},t=>[index('idx_sessions_branch_created').on(t.branch,t.created)]);
export const codes=sqliteTable('codes',{id:text('id').primaryKey(),branch:text('branch').notNull(),expires:integer('expires').notNull()});
export const editions=sqliteTable('editions',{id:text('id').primaryKey(),data:text('data').notNull(),updated:integer('updated').notNull()});
export const registrations=sqliteTable('registrations',{phone:text('phone').primaryKey(),branch:text('branch').notNull(),consent:integer('consent').notNull(),created:integer('created').notNull(),notice:text('notice').notNull()});

export const adminAccounts=sqliteTable('admin_accounts',{id:text('id').primaryKey(),email:text('email').notNull().unique(),salt:text('salt').notNull(),password_hash:text('password_hash').notNull(),created:integer('created').notNull()});
export const adminSessions=sqliteTable('admin_sessions',{id:text('id').primaryKey(),account_id:text('account_id').notNull().references(()=>adminAccounts.id),expires:integer('expires').notNull()},t=>[index('idx_admin_sessions_expires').on(t.expires)]);
export const adminLoginAttempts=sqliteTable('admin_login_attempts',{id:text('id').primaryKey(),attempts:integer('attempts').notNull(),expires:integer('expires').notNull()});
export const storyOverrides=sqliteTable('story_overrides',{url:text('url').primaryKey(),title:text('title').notNull(),summary:text('summary').notNull(),hidden:integer('hidden').notNull().default(0)});
