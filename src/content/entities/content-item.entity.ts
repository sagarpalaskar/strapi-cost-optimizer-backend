import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ContentType } from './content-type.entity';

@Entity('content_items')
export class ContentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contentTypeId: string;

  @ManyToOne(() => ContentType)
  @JoinColumn({ name: 'contentTypeId' })
  contentType: ContentType;

  @Column('jsonb')
  attributes: Record<string, any>;

  @Column({ nullable: true })
  publishedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
