import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1773720399210 implements MigrationInterface {
    name = 'InitialSchema1773720399210'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('CUSTOMER', 'ADMIN', 'DEV', 'FINANCE')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(255) NOT NULL, "phone" character varying(20), "avatar_url" character varying(500), "role" "public"."users_role_enum" NOT NULL DEFAULT 'CUSTOMER', "company_name" character varying(255), "company_size" character varying(50), "industry" character varying(100), "is_active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP, "refresh_token_hash" character varying(255), "password_reset_token" character varying(255), "password_reset_expires" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('COLLECTING', 'COLLECTED', 'REVIEWING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD')`);
        await queryRunner.query(`CREATE TYPE "public"."projects_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "customer_id" uuid NOT NULL, "project_name" character varying(255) NOT NULL, "project_code" character varying(50) NOT NULL, "description" text, "status" "public"."projects_status_enum" NOT NULL DEFAULT 'COLLECTING', "collection_progress" jsonb NOT NULL DEFAULT '{}', "requirement_doc_url" character varying(500), "requirement_json" jsonb, "estimated_budget" numeric(15,2), "actual_budget" numeric(15,2), "estimated_deadline" date, "priority" "public"."projects_priority_enum" NOT NULL DEFAULT 'MEDIUM', CONSTRAINT "UQ_11b19c7d40d07fc1a4e167995e1" UNIQUE ("project_code"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_task_type_enum" AS ENUM('BACKEND', 'FRONTEND', 'DATABASE', 'DESIGN', 'DEVOPS', 'TESTING', 'OTHER')`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_status_enum" AS ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED')`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`);
        await queryRunner.query(`CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "parent_task_id" uuid, "title" character varying(255) NOT NULL, "description" text, "task_type" "public"."tasks_task_type_enum", "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'TODO', "priority" "public"."tasks_priority_enum" NOT NULL DEFAULT 'MEDIUM', "assignee_id" uuid, "estimated_hours" numeric(6,1), "actual_hours" numeric(6,1), "due_date" date, "sort_order" integer NOT NULL DEFAULT '0', "tags" text array, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "task_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "task_id" uuid NOT NULL, "user_id" uuid NOT NULL, "content" text NOT NULL, CONSTRAINT "PK_83b99b0b03db29d4cafcb579b77" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying(20) NOT NULL, CONSTRAINT "UQ_b3f491d3a3f986106d281d8eb4b" UNIQUE ("project_id", "user_id"), CONSTRAINT "PK_0b2f46f804be4aea9234c78bcc9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('NEW_PROJECT', 'COLLECTION_COMPLETE', 'TASK_ASSIGNED', 'REVIEW_NEEDED', 'STATUS_CHANGED', 'COMMENT')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "content" text, "type" "public"."notifications_type_enum" NOT NULL, "reference_type" character varying(20), "reference_id" uuid, "is_read" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."conversations_conversation_type_enum" AS ENUM('AI_COLLECT', 'SUPPORT', 'CLARIFY')`);
        await queryRunner.query(`CREATE TYPE "public"."conversations_status_enum" AS ENUM('ACTIVE', 'PAUSED', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "title" character varying(255), "conversation_type" "public"."conversations_conversation_type_enum" NOT NULL DEFAULT 'AI_COLLECT', "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'ACTIVE', "total_messages" integer NOT NULL DEFAULT '0', "total_tokens" integer NOT NULL DEFAULT '0', "last_message_at" TIMESTAMP, "metadata" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."messages_sender_type_enum" AS ENUM('USER', 'AI', 'SYSTEM')`);
        await queryRunner.query(`CREATE TYPE "public"."messages_message_type_enum" AS ENUM('TEXT', 'IMAGE', 'FILE', 'SYSTEM_NOTICE')`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "sender_type" "public"."messages_sender_type_enum" NOT NULL, "sender_id" uuid, "content" text NOT NULL, "message_type" "public"."messages_message_type_enum" NOT NULL DEFAULT 'TEXT', "metadata" jsonb NOT NULL DEFAULT '{}', "is_read" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3bc55a7c3f9ed54b520bb5cfe2" ON "messages" ("conversation_id") `);
        await queryRunner.query(`CREATE TYPE "public"."finance_records_type_enum" AS ENUM('QUOTE', 'INVOICE', 'PAYMENT')`);
        await queryRunner.query(`CREATE TYPE "public"."finance_records_status_enum" AS ENUM('PENDING', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "finance_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "type" "public"."finance_records_type_enum" NOT NULL, "amount" numeric(15,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'VND', "status" "public"."finance_records_status_enum" NOT NULL DEFAULT 'PENDING', "description" text, "due_date" date, "paid_at" TIMESTAMP, "file_url" character varying(500), "created_by" uuid, CONSTRAINT "PK_fa96ad926c6fef153a00736aeab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."collection_data_category_enum" AS ENUM('COMPANY_INFO', 'DEPARTMENTS', 'EMPLOYEES', 'WORKFLOWS', 'SALARY', 'SCHEDULING', 'FEATURES', 'SPECIAL_REQUIREMENTS', 'PRIORITIES', 'INTEGRATIONS')`);
        await queryRunner.query(`CREATE TABLE "collection_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "project_id" uuid NOT NULL, "category" "public"."collection_data_category_enum" NOT NULL, "data_key" character varying(100) NOT NULL, "data_value" jsonb NOT NULL, "confidence" numeric(3,2) NOT NULL DEFAULT '1', "source_message_id" uuid, "is_confirmed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_27fd0e34bace38094af1bfe3fb3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_8ee9cae5efccf846467e1cb005c" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_9eecdb5b1ed8c7c2a1b392c28d4" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_54fc42a253a8338488ec1f960ad" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_855d484825b715c545349212c7f" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_comments" ADD CONSTRAINT "FK_ba9e465cfc707006e60aae59946" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_comments" ADD CONSTRAINT "FK_07ff0d4347a198527663bda63d9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_b5729113570c20c7e214cf3f58d" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_9f16876c6b675f1f683e604b511" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_records" ADD CONSTRAINT "FK_75c77cfe270cdab1bb62b14241d" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_records" ADD CONSTRAINT "FK_4a1ff4c5bf76b6baa9d84a7db91" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_data" ADD CONSTRAINT "FK_1475202fa2248cf9aeb91a38097" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_data" ADD CONSTRAINT "FK_0f8a1ef10f081c40fe525d6747c" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_data" ADD CONSTRAINT "FK_b6fd8f6281c8b206e101adc2f3a" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "collection_data" DROP CONSTRAINT "FK_b6fd8f6281c8b206e101adc2f3a"`);
        await queryRunner.query(`ALTER TABLE "collection_data" DROP CONSTRAINT "FK_0f8a1ef10f081c40fe525d6747c"`);
        await queryRunner.query(`ALTER TABLE "collection_data" DROP CONSTRAINT "FK_1475202fa2248cf9aeb91a38097"`);
        await queryRunner.query(`ALTER TABLE "finance_records" DROP CONSTRAINT "FK_4a1ff4c5bf76b6baa9d84a7db91"`);
        await queryRunner.query(`ALTER TABLE "finance_records" DROP CONSTRAINT "FK_75c77cfe270cdab1bb62b14241d"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_9f16876c6b675f1f683e604b511"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_b5729113570c20c7e214cf3f58d"`);
        await queryRunner.query(`ALTER TABLE "task_comments" DROP CONSTRAINT "FK_07ff0d4347a198527663bda63d9"`);
        await queryRunner.query(`ALTER TABLE "task_comments" DROP CONSTRAINT "FK_ba9e465cfc707006e60aae59946"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_855d484825b715c545349212c7f"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_54fc42a253a8338488ec1f960ad"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_9eecdb5b1ed8c7c2a1b392c28d4"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_8ee9cae5efccf846467e1cb005c"`);
        await queryRunner.query(`DROP TABLE "collection_data"`);
        await queryRunner.query(`DROP TYPE "public"."collection_data_category_enum"`);
        await queryRunner.query(`DROP TABLE "finance_records"`);
        await queryRunner.query(`DROP TYPE "public"."finance_records_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."finance_records_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3bc55a7c3f9ed54b520bb5cfe2"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."messages_message_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."messages_sender_type_enum"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_conversation_type_enum"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "project_members"`);
        await queryRunner.query(`DROP TABLE "task_comments"`);
        await queryRunner.query(`DROP TABLE "tasks"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_task_type_enum"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TYPE "public"."projects_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
