import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('content_audit_logs')
@Index(['contentId'])
@Index(['customUserId'])
@Index(['timestamp'])
@Index(['contentType'])
export class ContentAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contentId: string; // Strapi content item ID (can be numeric ID or documentId)

  @Column()
  action: string; // 'created', 'updated', 'deleted'

  @Column('uuid', { nullable: true })
  customUserId: string | null; // ID of the custom user from your backend (users entity), null if not available

  @Column({ nullable: true })
  contentType: string | null; // Content type name (e.g., 'article', 'product')

  @Column({ nullable: true })
  contentName: string | null; // Content item name/title for display

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}

