# Product: Family Relationship Intelligence Platform

A collaborative web application for building, managing, and exploring family trees.

## Core Capabilities

- **Family tree management**: Create, update, soft-delete, and restore family trees
- **Collaborative editing**: Invite-based access with role-based permissions (Admin, Editor, Viewer)
- **Person profiles**: Rich profiles with biographical data, historical records, and media
- **Relationship modeling**: Parent-child, spouse, and other relationship types between persons
- **Invite system**: Shareable links with configurable role, expiry, and usage limits
- **Authentication**: Google OAuth via Firebase with server-side session management

## Key Domain Concepts

- **Tree**: A family tree owned by one or more admins, containing persons and relationships
- **Membership**: A user's role-based association with a tree (admin/editor/viewer)
- **Person**: An individual in a family tree (may or may not be linked to a platform user)
- **Relationship**: A typed connection between two persons in a tree
- **Invite**: A tokenized link granting access to a tree with a specific role
- **Soft delete**: Entities are marked deleted (not removed) and restorable within 30 days
